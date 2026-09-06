import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2025-02-28.acacia' as any,
});

export async function POST(req: Request) {
    try {
        const { priceId, userId } = await req.json();
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: priceId, quantity: 1 }],
            mode: 'payment',
            success_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?success=true`,
            cancel_url: `${process.env.NEXT_PUBLIC_SITE_URL}/?canceled=false`,
            metadata: { userId },
        });
        return NextResponse.json({ url: session.url });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}