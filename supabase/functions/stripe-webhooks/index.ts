// Supabase Edge Function for handling Stripe Webhooks.
// This function listens for events from Stripe and updates user profiles accordingly.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@10.17.0?target=deno&no-check";

// Initialize Stripe with the API key from environment variables.
const stripe = new Stripe(Deno.env.get('STRIPE_API_KEY') ?? '', {
  apiVersion: '2022-11-15',
  httpClient: Stripe.createFetchHttpClient(),
});

serve(async (req) => {
  const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
  }

  try {
    const signature = req.headers.get('Stripe-Signature');
    const signingSecret = Deno.env.get('STRIPE_WEBHOOK_SIGNING_SECRET');
    const body = await req.text();

    if (!signature || !signingSecret) {
      throw new Error('Missing Stripe signature or signing secret.');
    }

    // --- 1. Verify Stripe Signature ---
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, signingSecret);
    } catch (err) {
      return new Response(JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }), { status: 400, headers });
    }

    // --- 2. Initialize Supabase Admin Client ---
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // --- 3. Handle the Stripe Event ---
    const data = event.data.object as any;

    switch (event.type) {
      case 'checkout.session.completed':
        // The user_id should be passed as client_reference_id when creating the checkout session.
        const userId = data.client_reference_id;
        if (!userId) {
          throw new Error('Missing client_reference_id (user_id) in checkout session.');
        }

        // Extract subscription details (this depends on your Stripe setup)
        // For this example, we assume a `tier` was passed in the metadata.
        const tier = data.metadata.tier || 'pro';

        // Update the user's profile in Supabase
        const { error } = await supabaseAdmin
          .from('profiles')
          .update({ subscription_tier: tier })
          .eq('id', userId);

        if (error) {
          throw new Error(`Failed to update profile for user ${userId}: ${error.message}`);
        }

        console.log(`Successfully upgraded user ${userId} to ${tier} tier.`);
        break;

      // TODO: Handle other events like `customer.subscription.deleted` to downgrade users.
      case 'customer.subscription.deleted':
        // Find the user associated with this subscription and downgrade them.
        console.log('Subscription deleted event received.');
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200, headers });

  } catch (error) {
    console.error('Stripe webhook error:', error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
});
