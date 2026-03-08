import { Hono } from "hono";
import { html } from "hono/html";
import type { Env } from "../../core-logic/env";
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
    
  let initialMessages: { id: string; content: string; userId: string; createdAt: number | null }[] = [];
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

        if (!guestAccess) {
          input.placeholder = 'Sign in to send messages';
          input.disabled = true;
          document.querySelector('#chat-form button').disabled = true;
        }

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          if (!guestAccess) return;
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
      <style>
        /* Base reset */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: system-ui, -apple-system, sans-serif; background: transparent; }

        /* Layout */
        .flex { display: flex; }
        .flex-col { flex-direction: column; }
        .flex-1 { flex: 1 1 0%; }
        .items-start { align-items: flex-start; }
        .items-center { align-items: center; }
        .items-baseline { align-items: baseline; }
        .justify-center { justify-content: center; }
        .gap-2 { gap: 0.5rem; }
        .gap-3 { gap: 0.75rem; }
        .h-screen { height: 100vh; }
        .overflow-y-auto { overflow-y: auto; }
        .p-4 { padding: 1rem; }
        .p-3 { padding: 0.75rem; }
        .space-y-4 > * + * { margin-top: 1rem; }

        /* Sizing */
        .w-8 { width: 2rem; }
        .h-8 { height: 2rem; }
        .w-full { width: 100%; }

        /* Typography */
        .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
        .text-xs { font-size: 0.75rem; line-height: 1rem; }
        .font-bold { font-weight: 700; }
        .font-semibold { font-weight: 600; }
        .font-medium { font-weight: 500; }
        .tracking-wider { letter-spacing: 0.05em; }
        .uppercase { text-transform: uppercase; }

        /* Colors */
        .text-slate-100 { color: #f1f5f9; }
        .text-slate-200 { color: #e2e8f0; }
        .text-slate-300 { color: #cbd5e1; }
        .text-slate-400 { color: #94a3b8; }
        .text-white { color: #ffffff; }
        .bg-slate-700 { background-color: #334155; }
        .bg-slate-800 { background-color: #1e293b; }
        .bg-slate-900\/90 { background-color: rgba(15, 23, 42, 0.9); }
        .bg-blue-500 { background-color: #3b82f6; }
        .bg-blue-600 { background-color: #2563eb; }
        .hover\:bg-blue-500:hover { background-color: #3b82f6; }
        .border-slate-700 { border-color: #334155; }
        .border-slate-800 { border-color: #1e293b; }
        .border-t { border-top-width: 1px; border-top-style: solid; }

        /* Shape & spacing helpers */
        .rounded-full { border-radius: 9999px; }
        .px-4 { padding-left: 1rem; padding-right: 1rem; }
        .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
        .mt-1 { margin-top: 0.25rem; }
        .border { border-width: 1px; border-style: solid; }

        /* Focus states */
        .focus\:outline-none:focus { outline: none; }
        .focus\:border-blue-500:focus { border-color: #3b82f6; }
        .focus\:ring-1:focus { box-shadow: 0 0 0 1px #3b82f6; }
        .focus\:ring-blue-500:focus { --ring-color: #3b82f6; }

        /* Transitions */
        .transition-colors { transition-property: color, background-color, border-color; transition-duration: 150ms; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); }

        /* Animation */
        @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fade-in { animation: fadeIn 0.2s ease-out; }

        /* Element resets */
        input { background: none; border: none; color: inherit; font: inherit; }
        button { cursor: pointer; border: none; font: inherit; }
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
