import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

export async function POST(req: Request) {
    const body = await req.text();
    const signature = (await headers()).get('stripe-signature')!;

    let event: Stripe.Event;
    try {
        event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: any) {
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.userId;
        const priceId = session.line_items?.data[0]?.price?.id; // 或通过 metadata/amount 识别购买的是哪个套餐

        if (userId) {
            const { data } = await supabase.from('user_credits').select('credits').eq('id', userId).single();
            const currentCredits = data?.credits || 0;
            // 简单起见，统一充值 50 次（你可以根据 priceId 区分 50 或 200）
            await supabase.from('user_credits').update({ credits: currentCredits + 50 }).eq('id', userId);
        }
    }

    return NextResponse.json({ received: true });
}