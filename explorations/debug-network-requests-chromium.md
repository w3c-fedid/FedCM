Chromium now provides developer support for inspecting FedCM API network requests within DevTools.

1. To inspect network requests initiated by FedCM, open Chrome DevTools by pressing Ctrl + Shift + I or navigating to Settings → More tools → Developer tools.
<p align="center">
     <img width="467" src="https://github.com/fedidcg/FedCM/blob/main/explorations/static/devtools/open-devtools.png"/>
</p>
2. Navigate to the website you want to investigate e.g. https://webid-fcm.glitch.me
<p align="center">
     <img width="467" src="https://github.com/fedidcg/FedCM/blob/main/explorations/static/devtools/navigate-link.png"/>
</p>
3. In the Network tab, filter requests by selecting the type "fedcm" to view all network requests initiated by FedCM.
<p align="center">
     <img width="467" src="https://github.com/fedidcg/FedCM/blob/main/explorations/static/devtools/devtools-fedcm.png"/>
</p>
4. Click on any individual request to view detailed information about it.
<p align="center">
     <img width="467" src="https://github.com/fedidcg/FedCM/blob/main/explorations/static/net-export/request-inspect.png"/>
</p>