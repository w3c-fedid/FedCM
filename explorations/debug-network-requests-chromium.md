While the Chrome team is trying to integrate FedCM into devtools, we suggest developers to use the following tools to debug network requests.

1. Open chrome://net-export from the URL bar. Select “Include raw bytes” and
click “Start Logging to Disk”. Select a location to save the logs when prompted.
<p align="center">
     <img width="467" src="https://github.com/fedidcg/FedCM/blob/main/explorations/static/net-export/net-export-entry.png"/>
</p>
2. Open the page that calls the FedCM API. e.g. https://webid-fcm.glitch.me
<p align="center">
     <img width="467" src="https://github.com/fedidcg/FedCM/blob/main/explorations/static/net-export/fedcm-1.png"/>
</p>
3. Go through the FedCM flow to debug all network requests
<p align="center">
     <img width="467" src="https://github.com/fedidcg/FedCM/blob/main/explorations/static/net-export/fedcm-2.png"/>
</p>
4. Stop the logging on chrome://net-export
<p align="center">
     <img width="467" src="https://github.com/fedidcg/FedCM/blob/main/explorations/static/net-export/net-export-stop.png"/>
</p>
5. Load the logs into https://netlog-viewer.appspot.com/
<p align="center">
     <img width="467" src="https://github.com/fedidcg/FedCM/blob/main/explorations/static/net-export/netlog-viewer-entry.png"/>
</p>
6. Under `Events` from the left, filter the logs with `type:URL_REQUEST`
<p align="center">
     <img width="467" src="https://github.com/fedidcg/FedCM/blob/main/explorations/static/net-export/netlog-viewer-example.png"/>
</p>
7. The network requests that were sent to different endpoints can be viewed
individually. They also include the response that the browser has received. If
raw bytes are selected from step 1, the detailed response such as name, token
string etc. will show up on the right.
