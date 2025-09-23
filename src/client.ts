const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
const ws = new WebSocket(`${wsProtocol}//${location.host}`);

const messagesList = document.getElementById("messages") as HTMLUListElement;
const sendBtn = document.getElementById("sendBtn") as HTMLButtonElement;
const input = document.getElementById("msg") as HTMLInputElement;

ws.onmessage = (event: MessageEvent) => {
  const li = document.createElement("li");
  li.textContent = event.data;
  messagesList.appendChild(li);
};

sendBtn.addEventListener("click", () => {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(input.value);
  } else {
    alert("WebSocket is not connected.");
  }
  input.value = "";
});