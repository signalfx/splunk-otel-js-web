# A note on certs in this directory
The certificate files you will find in this directory are self-signed, and only used for locally executed tests.
You can regenerate them by running:
```bash
openssl req -nodes -new -x509 -keyout server.key -out server.cert  
```
