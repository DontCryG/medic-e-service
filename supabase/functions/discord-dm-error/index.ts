import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { errorMsg, errorStack, urlLocation, userAgent } = await req.json()
    
    // Credentials from environment variables
    const BOT_TOKEN = Deno.env.get('DISCORD_BOT_TOKEN');
    const USER_ID = '524528448446660608'; // Hardcoded since it's just the recipient ID

    if (!BOT_TOKEN) {
      throw new Error('DISCORD_BOT_TOKEN is not set in Edge Function secrets.');
    }

    // 1. Create DM Channel
    const dmRes = await fetch('https://discord.com/api/v10/users/@me/channels', {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ recipient_id: USER_ID })
    });

    const dmData = await dmRes.json();
    if (!dmData.id) {
      throw new Error('Failed to create DM channel: ' + JSON.stringify(dmData));
    }

    const channelId = dmData.id;

    // 2. Send Message to the DM Channel
    const embed = {
      title: '🚨 Website Error Alert',
      color: 16711680, // Red
      fields: [
        { name: 'Error', value: errorMsg || 'Unknown Error', inline: false },
        { name: 'Location', value: urlLocation || 'Unknown', inline: false },
        { name: 'User Agent', value: userAgent || 'Unknown', inline: false },
      ],
      timestamp: new Date().toISOString()
    };

    if (errorStack) {
      embed.fields.push({ name: 'Stack Trace', value: `\`\`\`\n${errorStack.substring(0, 1000)}\n\`\`\``, inline: false });
    }

    const msgRes = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ embeds: [embed] })
    });

    const msgData = await msgRes.json();

    return new Response(
      JSON.stringify({ success: true, message: 'Alert sent' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    )
  }
})
