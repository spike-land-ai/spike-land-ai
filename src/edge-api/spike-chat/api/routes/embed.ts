import { Hono } from "hono";
import { html } from "hono/html";
import { Env } from "../../core-logic/env";
import { createDb } from "../../db/db-index";
import { channels, messages } from "../../db/schema";
import { eq, and, desc } from "drizzle-orm";

export const embedRouter = new Hono<{ Bindings: Env }>();

embedRouter.get("/:workspace/:channel", async (c) => {
  const workspaceId = c.req.param("workspace");
  const channelSlug = c.req.param("channel");
  const guestAccess = c.req.query("guest") !== "false";
  
  const db = createDb(c.env.DB);
  
  // Find the channel
  const [channel] = await db.select()
    .from(channels)
    .where(and(eq(channels.workspaceId, workspaceId), eq(channels.slug, channelSlug)));
    
  let initialMessages: any[] = [];
  let channelId = "unknown";
  
  if (channel) {
    channelId = channel.id;
    const msgs = await db.select()
      .from(messages)
      .where(eq(messages.channelId, channel.id))
      .orderBy(desc(messages.createdAt))
      .limit(50);
    initialMessages = msgs.reverse();
  }

  // Define the WS URL logic in script
  const scriptContent = `
        const guestAccess = ${guestAccess};
        const channelId = "${channelId}";
        const wsUrl = \`\${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//\${window.location.host}/api/v1/channels/\${channelId}/ws?userId=visitor-\${crypto.randomUUID()}&displayName=Visitor\`;
        
        let ws;
        function connect() {
          if (channelId === "unknown") return;
          ws = new WebSocket(wsUrl);
          
          ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'message_new') {
              appendMessage(data.message.content, data.message.userId);
            }
          };
          
          ws.onclose = () => {
            setTimeout(connect, 3000);
          };
        }
        
        connect();

        const form = document.getElementById('chat-form');
        const input = document.getElementById('message-input');
        const messagesDiv = document.getElementById('messages');

        function appendMessage(text, userId) {
          const isGuest = userId.startsWith('visitor');
          const name = isGuest ? 'Visitor' : userId;
          const letter = name.charAt(0).toUpperCase();
          const color = isGuest ? 'bg-slate-700' : 'bg-blue-500';

          const wrapper = document.createElement('div');
          wrapper.className = 'flex items-start gap-3 animate-fade-in';

          const avatar = document.createElement('div');
          avatar.className = 'w-8 h-8 rounded-full ' + color + ' flex items-center justify-center font-bold text-sm';
          avatar.textContent = letter;

          const content = document.createElement('div');
          const header = document.createElement('div');
          header.className = 'flex items-baseline gap-2';

          const nameSpan = document.createElement('span');
          nameSpan.className = 'font-semibold text-sm';
          nameSpan.textContent = name;

          const timeSpan = document.createElement('span');
          timeSpan.className = 'text-xs text-slate-400';
          timeSpan.textContent = 'Just now';

          header.appendChild(nameSpan);
          header.appendChild(timeSpan);

          const body = document.createElement('p');
          body.className = 'text-sm mt-1 text-slate-300';
          body.textContent = text;

          content.appendChild(header);
          content.appendChild(body);
          wrapper.appendChild(avatar);
          wrapper.appendChild(content);

          messagesDiv.appendChild(wrapper);
          messagesDiv.scrollTop = messagesDiv.scrollHeight;
        }

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          const text = input.value.trim();
          if (!text || channelId === "unknown") return;
          
          input.value = '';
          
          // Post message to API
          await fetch('/api/v1/messages', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'x-guest-access': 'true'
            },
            body: JSON.stringify({ channelId, content: text })
          });
        });
  `;

  return c.html(html`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Spike Chat - ${channelSlug}</title>
      <script src="https://cdn.tailwindcss.com"></script>
      <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: transparent; }
      </style>
    </head>
    <body class="flex flex-col h-screen text-slate-100 bg-slate-900/90">
      <div class="flex-1 overflow-y-auto p-4 space-y-4" id="messages">
        ${initialMessages.length === 0 ? html`
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center font-bold text-sm">S</div>
          <div>
            <div class="flex items-baseline gap-2">
              <span class="font-semibold text-sm">System</span>
            </div>
            <p class="text-sm mt-1 text-slate-300">Welcome to #${channelSlug}. This is the start of the channel.</p>
          </div>
        </div>
        ` : ''}
        ${initialMessages.map(msg => html`
        <div class="flex items-start gap-3">
          <div class="w-8 h-8 rounded-full ${msg.userId.startsWith('visitor') ? 'bg-slate-700' : 'bg-blue-500'} flex items-center justify-center font-bold text-sm">${msg.userId.startsWith('visitor') ? 'V' : msg.userId.charAt(0).toUpperCase()}</div>
          <div>
            <div class="flex items-baseline gap-2">
              <span class="font-semibold text-sm">${msg.userId.startsWith('visitor') ? 'Visitor' : msg.userId}</span>
            </div>
            <p class="text-sm mt-1 text-slate-300">${msg.content}</p>
          </div>
        </div>
        `)}
      </div>
      
      <form id="chat-form" class="p-3 border-t border-slate-800 flex gap-2">
        <input 
          type="text" 
          id="message-input"
          placeholder="Type a message as a guest..." 
          class="flex-1 bg-slate-800 text-sm rounded-full px-4 py-2 border border-slate-700 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-slate-200"
          required
          ${channelId === 'unknown' ? 'disabled' : ''}
        />
        <button type="submit" class="bg-blue-600 hover:bg-blue-500 text-white rounded-full px-4 py-2 text-sm font-medium transition-colors" ${channelId === 'unknown' ? 'disabled' : ''}>
          Send
        </button>
      </form>

      <script>${scriptContent}</script>
    </body>
    </html>
  `);
});
