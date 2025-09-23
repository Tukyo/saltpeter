"use strict";
const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${wsProtocol}//${location.host}`);
const messagesList = document.getElementById("messages");
const sendBtn = document.getElementById("sendBtn");
const input = document.getElementById("msg");
ws.onmessage = (event) => {
    const li = document.createElement("li");
    li.textContent = event.data;
    messagesList.appendChild(li);
};
sendBtn.addEventListener("click", () => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(input.value);
    }
    else {
        alert("WebSocket is not connected.");
    }
    input.value = "";
});
//# sourceMappingURL=client.js.map