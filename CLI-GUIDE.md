# Test Server CLI Guide

> Interactive command-line interface for testing the WhatsApp Gateway

## Starting the Server

```bash
npm run test:server
```

The server will start and present a CLI prompt:
```
🎮 Command>
```

---

## Available Commands

### 📨 Message Commands

#### Send Text Message
```bash
send <apiKey> <phone> <message>
```

**Example:**
```bash
send test-api-key-123 +1234567890 Hello World!
send test-api-key-123 +1234567890 This is a test message with multiple words
```

**Output:**
```
📨 Sending message...
   API Key: test-api-key***
   Phone: +1234567890
   Message: Hello World!

✅ Message sent successfully!
   Request ID: req-abc-123
   Message ID: msg_xyz
   Device: 12345678...
```

---

#### Send Image
```bash
image <apiKey> <phone> [caption]
```

**Example:**
```bash
image test-api-key-123 +1234567890 Check this out!
image test-api-key-123 +1234567890
```

**Output:**
```
🖼️  Sending image...
   API Key: test-api-key***
   Phone: +1234567890
   Caption: Check this out!

✅ Image sent successfully!
   Request ID: req-def-456
   Message ID: msg_abc
```

---

### 📱 Device Commands

#### List All Devices
```bash
devices
```

**Output:**
```
📱 Active Devices:
============================================================

All Connected Devices:

API Key: test-api-key*** (Test User 1)
  Devices: 2
    1. 12345678... [Ready] (15s ago)
    2. 87654321... [Ready] (8s ago)

API Key: test-api-key*** (Test User 2)
  Devices: 1
    1. abcdef12... [Not Ready] (45s ago)

Total Active Devices: 3
```

---

#### List Devices for Specific API Key
```bash
devices <apiKey>
```

**Example:**
```bash
devices test-api-key-123
```

**Output:**
```
📱 Active Devices:
============================================================

API Key: test-api-key***
Active Devices: 2

Device 1:
  Session ID: 12345678-1234-1234-1234-123456789abc
  Status: WhatsApp Web logged in
  Ready: ✅ Yes
  Connected: 11/5/2025, 3:45:23 PM
  Last Heartbeat: 11/5/2025, 3:50:10 PM
  Last Seen: 15s ago

Device 2:
  Session ID: 87654321-4321-4321-4321-cba987654321
  Status: WhatsApp Web logged in
  Ready: ✅ Yes
  Connected: 11/5/2025, 3:48:10 PM
  Last Heartbeat: 11/5/2025, 3:50:17 PM
  Last Seen: 8s ago
```

---

### 📊 Information Commands

#### Show Statistics
```bash
stats
```

**Output:**
```
📊 Test Statistics:
============================================================

Total Messages Sent: 15
Successful: 12
Failed: 3

Total Errors: 5

Recent Message Logs (last 5):
  [3:50:15 PM] message-sent - +1234567890 (success)
  [3:50:12 PM] image-sent - +9876543210 (success)
  [3:50:05 PM] send-failed - +5555555555 (failed)
  ...
```

---

#### Health Check
```bash
health
```

**Output:**
```
🏥 Server Health:
============================================================
Status: ✅ Running
Active Sessions: 3
Uptime: 1234s (20m 34s)
Checked At: 11/5/2025, 3:50:25 PM
```

---

#### View Recent Logs
```bash
logs [limit]
```

**Examples:**
```bash
logs           # Show last 10 logs
logs 20        # Show last 20 logs
logs 5         # Show last 5 logs
```

**Output:**
```
📜 Recent Message Logs (last 10):
============================================================
✅ [3:50:15 PM] message-sent - +1234567890 (success)
✅ [3:50:12 PM] image-sent - +9876543210 (success)
❌ [3:50:05 PM] send-failed - +5555555555 (failed)
✅ [3:49:58 PM] message-sent - +1111111111 (success)
...
```

---

### 🧪 Testing Commands

#### Run All Tests
```bash
test
```

**Output:**
```
🧪 Running Test Commands...

1️⃣  Testing sendMessage...
✅ Message sent successfully

2️⃣  Testing sendImage...
✅ Image sent successfully

3️⃣  Testing getActiveSessions...
Active sessions: 2

4️⃣  Testing getHealth...
Server status: running

✅ All tests completed!
```

---

### 🔧 Utility Commands

#### Clear Screen
```bash
clear
```

Clears the terminal screen.

---

#### Show Help
```bash
help
```

Shows all available commands with examples.

---

#### Exit Server
```bash
exit
```
or
```bash
quit
```

Gracefully stops the server and exits.

**Output:**
```
👋 Shutting down...
🛑 Shutting down test server...
✅ Test server stopped gracefully
```

---

## Complete Usage Examples

### Example 1: Testing Message Sending

```bash
# Start server
npm run test:server

# Wait for CLI prompt, then:
🎮 Command> devices
# Shows no devices connected

# Connect your Chrome Extension to ws://localhost:3000/wa-ext-ws

🎮 Command> devices
# Shows your connected device

🎮 Command> send test-api-key-123 +1234567890 Hello from CLI!
# Sends message through your extension

🎮 Command> stats
# Shows statistics
```

---

### Example 2: Managing Multiple Devices

```bash
🎮 Command> devices
# Lists all devices across all API keys

🎮 Command> devices test-api-key-123
# Lists only devices for specific API key

🎮 Command> send test-api-key-123 +1234567890 Test message
# Sends via round-robin to one of the devices

🎮 Command> logs 5
# See recent activity
```

---

### Example 3: Testing Different Features

```bash
🎮 Command> test
# Runs all automated tests

🎮 Command> health
# Check server status

🎮 Command> image test-api-key-123 +1234567890 Cool image!
# Send test image

🎮 Command> stats
# View results

🎮 Command> exit
# Stop server
```

---

## Keyboard Shortcuts

- **Ctrl+C** - Exit the server (with graceful shutdown)
- **Up/Down Arrow** - Navigate command history
- **Tab** - Auto-complete (if available)

---

## Tips

1. **Copy-paste phone numbers** - Use full international format with +
2. **Multi-word messages** - No quotes needed: `send key +123 Hello World works fine`
3. **Check devices first** - Run `devices` before sending to verify connections
4. **Monitor with logs** - Use `logs` to see what's happening in real-time
5. **Health checks** - Use `health` to verify server uptime and active sessions

---

## Troubleshooting

### No devices connected
```bash
🎮 Command> devices
❌ No devices connected
```
**Solution:** Connect your Chrome Extension to `ws://localhost:3000/wa-ext-ws` with a valid API key.

---

### Message sending fails
```bash
🎮 Command> send test-api-key-123 +1234567890 Test
❌ Failed to send message:
   Error: No active device available for this API key
   Code: NO_ACTIVE_DEVICE
```
**Solution:** 
1. Check `devices test-api-key-123` 
2. Ensure device shows `Ready: ✅ Yes`
3. Check extension is connected and WhatsApp is logged in

---

### Invalid API key
```bash
🎮 Command> send wrong-key +1234567890 Test
❌ Failed to send message:
   Error: No active device available for this API key
```
**Solution:** Use one of the valid test API keys:
- `test-api-key-123`
- `test-api-key-456`
- `test-api-key-789`

---

## Integration with Chrome Extension

While the CLI is running:

1. Connect your Chrome Extension to `ws://localhost:3000/wa-ext-ws`
2. Use API key: `test-api-key-123`
3. Extension will appear in `devices` output
4. Use `send` and `image` commands to test
5. Monitor `logs` to see message flow

The CLI provides an easy way to test your extension integration without writing additional code!
