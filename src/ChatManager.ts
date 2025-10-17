import { CHAT } from "./Config";

import { RoomManager } from "./RoomManager";
import { ChatMessage } from "./Types";
import { UserInterface } from "./UserInterface";

export class ChatManager {
    constructor(private roomManager: RoomManager, private ui: UserInterface) { }

    // #region [ Chat Management ]
    //
    /**
     * Sends a message in the chat.
     */
    public sendChatMessage(userId: string): void {
        if (!this.ui.chatInput || !this.ui.chatInput.value.trim()) return;

        const message = this.ui.chatInput.value.trim();
        if (message.length > CHAT.MAX_MESSAGE_LENGTH) { //TODO: Abstract reliance on config
            alert(`Message too long! Max ${CHAT.MAX_MESSAGE_LENGTH} characters.`);
            return;
        }

        // Send message to server
        this.roomManager.sendMessage(JSON.stringify({
            type: 'chat-message',
            message: message,
            timestamp: Date.now()
        }));

        // Display own message immediately
        this.displayChatMessage({senderId: userId, message: message, isOwn: true});

        // Clear input
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
        while (this.ui.chatMessages.children.length > CHAT.MAX_MESSAGES) {
            this.ui.chatMessages.removeChild(this.ui.chatMessages.firstChild!);
        }
    }

    /**
     * Resets the chat.
     */
    public clearChat(): void {
        if (this.ui.chatMessages) {
            this.ui.chatMessages.innerHTML = '';
        }
        if (this.ui.chatInput) {
            this.ui.chatInput.value = '';
        }
    }
    //
    // #endregion
}