## Connecteren via mongosh-client

Users opvragen:
- k get mongodbcommunity -o jsonpath='{.items[*].spec.users}'
  - output: [{"db":"admin","name":"quote-user","passwordSecretRef":{"name":"mongodb-password"},"roles":[{"db":"quote-db","name":"readWrite"}],"scramCredentialsSecretName":"quote-user-scram"}]

Wachtwoord opvragen:
- k get secret mongodb-password -o jsonpath='{.data.password}' | base64 --decode

Start mongosh-client:
- vraag de ClusterIP van mongodb-service op en vul die in op XXX.XXX.XXX.XXX in het volgende commando:
  ```bash
  k run mongosh-client --rm -it --image=rtsp/mongosh -- mongosh 'mongodb://quote-user:ChangeThisPassword123!@XXX.XXX.XXX.XXX:27017/quote-db?authSource=admin'
  ```

Query Mongo DB:
```bash
mongodb-cluster [direct: primary] quote-db> show dbs
quote-db  44.00 KiB
mongodb-cluster [direct: primary] quote-db> show collections
quotes
mongodb-cluster [direct: primary] quote-db> db.quotes.find().pretty()
[
  {
    _id: ObjectId('6a0dd04fbaa20a0a798910c2'),
    author: 'Albert Einstein',
    createdAt: ISODate('2026-05-20T15:16:31.622Z'),
    likeCount: 0,
    quoteId: 1,
    quoteText: 'The person who never made a mistake never tried anything new.',
    source: 'ZenQuotes'
  },
```

## Connecteren via port-forward en Compass

Zoek de naam van de mongodb-cluster pod op:
- k get pods
  - resultaat: mongodb-cluster-0

Start de port-forward op:
- k port-forward mongodb-cluster-0 27017:27017

Open Compass en gebruik deze connection string:
- mongodb://quote-user:ChangeThisPassword123!@localhost:27017/quote-db?authSource=admin

Compass foutmelding:
- Als Compass deze foutmelding geeft, kun je die negeren en dan werkt Compass gewoon: 'End-of-life MongoDB Detected
  Server or service "localhost:27017" appears to be running a version of MongoDB that is no longer supported.
  Server version (6.0.0) is considered end-of-life, consider upgrading to get the latest features and performance improvements.'

Als je wil upgraden:
- pas het versienummer naar 7.0.0 aan in mongodb-cluster.yaml
- je kunt nu `k apply -f mongodb-cluster.yaml` uitvoeren en de operator zal de vervolgens automatisch en zonder dataverlies herstarten met de nieuwere versie.
- eerste resultaat:
    ```bash
    MacBook-Pro-van-EGH:mongodb e.g.h.bulter$ k get mongodbcommunity
    NAME              PHASE     VERSION
    mongodb-cluster   Pending   6.0.0
    MacBook-Pro-van-EGH:mongodb e.g.h.bulter$
    ```
- tweede resultaat:
    ```bash
    MacBook-Pro-van-EGH:mongodb e.g.h.bulter$ k get mongodbcommunity
    NAME              PHASE     VERSION
    mongodb-cluster   Running   7.0.0
    MacBook-Pro-van-EGH:mongodb e.g.h.bulter$ 
    ```
  

