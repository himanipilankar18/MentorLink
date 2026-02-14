# What This Error Actually Means

## Your Error Summary

```
MongooseServerSelectionError
Reason: TopologyDescription { type: 'ReplicaSetNoPrimary', servers: Map(3) { ... } }
```

**All 3 servers show:**
- `type: 'Unknown'`
- `roundTripTime: -1`
- `error: null`

## What That Means

The driver **did** resolve DNS and found your Atlas replica set members:
- `ac-lycijz6-shard-00-00.jmrmhg3.mongodb.net:27017`
- `ac-lycijz6-shard-00-01.jmrmhg3.mongodb.net:27017`
- `ac-lycijz6-shard-00-02.jmrmhg3.mongodb.net:27017`

But it **could not open a TCP connection** to any of them. No handshake, no auth — the connection never got established.

So this is **not**:
- ❌ Wrong username/password (we never reached the server to authenticate)
- ❌ Wrong URI format (SRV resolved correctly)
- ❌ Missing database name (connection fails before that matters)

It **is**:
- ✅ **Network or firewall blocking outbound port 27017** (or TLS on that port)
- ✅ Your machine or network (ISP, school, corporate, antivirus) is blocking access to MongoDB Atlas

## What to Do

### 1. Allow Node / MongoDB in firewall (Windows)

1. Open **Windows Defender Firewall** → **Advanced settings**
2. **Outbound Rules** → **New Rule**
3. **Program** → Browse to your Node.js executable (e.g. `C:\Program Files\nodejs\node.exe`)
4. **Allow the connection**
5. Or temporarily disable firewall to test (then re-enable)

### 2. Check antivirus / security software

- Temporarily disable or add an exception for Node.js
- Some antivirus tools block unknown outbound connections on 27017

### 3. Try another network

- **Mobile hotspot** (phone WiFi) – if it works there, your usual network is blocking
- Different WiFi (e.g. home vs office/school)
- VPN **off** then **on** (some VPNs block, others fix corporate blocks)

### 4. Run the TCP check (this repo)

From project root:

```bash
node scripts/check-atlas-reachability.js
```

This tries to open a TCP socket to one of your Atlas hosts on port 27017. If it fails, something on your machine or network is blocking MongoDB.

### 5. Confirm with MongoDB Compass

- Install [MongoDB Compass](https://www.mongodb.com/products/compass)
- Use the same connection string from your `.env`
- If Compass also cannot connect from the same PC/network → same block (firewall/network)

### 6. Atlas side (double-check)

- **Network Access** → ensure `0.0.0.0/0` (or your IP) is listed and **Active**
- Wait a few minutes after adding/changing
- **Database Access** → user exists and has correct password (for when network is fixed)

## Summary

| Symptom                         | Likely cause                    |
|---------------------------------|----------------------------------|
| All servers `Unknown`, RTT `-1` | Firewall/network blocking 27017 |
| Authentication failed           | Wrong user/password or encoding |
| TLS / certificate error         | TLS or proxy issue              |

Your case = **firewall/network blocking**. Fix by allowing Node/27017 or using a network where outbound 27017 is allowed (e.g. mobile hotspot).
