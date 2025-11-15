import { ChatMessage } from "../Types";

import { ChatConfig } from "./ChatConfig";
import { RoomManager } from "../RoomManager";
import { UserInterface } from "../UserInterface";

export class ChatManager {
    public chatConfig: ChatConfig;

    constructor(private roomManager: RoomManager, private ui: UserInterface) { 
        this.chatConfig = new ChatConfig();
    }

    /**
     * Resets the chat.
     */
    public clear(): void {
        if (this.ui.chatMessages) {
            this.ui.chatMessages.innerHTML = '';
        }
        if (this.ui.chatInput) {
            this.ui.chatInput.value = '';
        }
    }

    // #region [ Chat Management ]
    //
    /**
     * Sends a message in the chat.
     */
    public sendChatMessage(userId: string): void {
        if (!this.ui.chatInput || !this.ui.chatInput.value.trim()) return;

        const message = this.ui.chatInput.value.trim();
        if (message.length > this.chatConfig.defaults.maxMessageLength) {
            alert(`Message too long! Max ${this.chatConfig.defaults.maxMessageLength} characters.`);
            return;
        }

        this.roomManager.sendMessage(JSON.stringify({
            type: 'chat-message',
            message: message,
            timestamp: Date.now()
        }));

        // Display my message and clear input field
        this.displayChatMessage({senderId: userId, message: message, isOwn: true});
        this.ui.chatInput.value = '';
    }

    /**
     * Displayes messages sent in the chat.
     */
    public displayChatMessage(params: ChatMessage): void {
        if (!this.ui.chatMessages) return;
        const { senderId, message, isOwn = false } = params;

        const messageDiv = document.createElement('div');
        messageDiv.className = `chat_message ${isOwn ? 'own' : 'other'}`;

        const senderSpan = document.createElement('span');
        senderSpan.className = 'sender';
        senderSpan.textContent = isOwn ? 'You:' : `${senderId}:`;

        const contentSpan = document.createElement('span');
        contentSpan.className = 'content';
        contentSpan.textContent = message;

        messageDiv.appendChild(senderSpan);
        messageDiv.appendChild(contentSpan);

        this.ui.chatMessages.appendChild(messageDiv);

        // Scroll to bottom
        this.ui.chatMessages.scrollTop = this.ui.chatMessages.scrollHeight;

        // Limit message history
        while (this.ui.chatMessages.children.length > this.chatConfig.defaults.maxMessages) {
            this.ui.chatMessages.removeChild(this.ui.chatMessages.firstChild!);
        }
    }

    //
    // #endregion
}