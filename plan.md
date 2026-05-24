# phase 3
The whole goal of phase 3 is improve the accuracy and increase the data to 50 signs. 

1. P2M5c — MS-ASL dataset download → retrain for better real-camera dynamic-sign accuracy. This is parked as an owner action (it's a large, auth-gated download). The ingest layer (ingest.py + signer-disjoint splits) is already built and ready for a small MsaslAdapter. The current dynamic model is ~62% top-1 / ~95% top-5 on 5-fold CV, and real-camera accuracy is lower due to domain shift — which is what this future work would address.

this si what you sugegsted.

2. I want to scrap the interent for strictly american sign language videos and any possible data that is credible. this will greatly imrpove our dataset and hopefully increase the accuracy. 
   
3. apply modifiers like blur or others to the data. I am not sure what can be applied on videos given that videos are the base data type for the dynamic signs. 