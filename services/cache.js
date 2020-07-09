const mongoose = require('mongoose');
const redis = require('redis');
const util = require('util');

const redisURL = 'redis://127.0.0.1:6379';
const client = redis.createClient(redisURL);
client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function(options = {}) {
    this.useCache = true;
    this.hashKey = JSON.stringify(options.key || '');
    return this;
};

mongoose.Query.prototype.exec = async function() {

    if(!this.useCache){
        return exec.apply(this, arguments);
    }

    const key = JSON.stringify(
        Object.assign({},this.getQuery(),{
        collection: this.mongooseCollection.name
        })
    );

    // see in redis cache, value for key
    const cacheValue = await client.hget(this.hashKey,key);

    //if present then return value
    if(cacheValue){
        const doc = JSON.parse(cacheValue);
        
        return Array.isArray(doc)
        ? doc.map(d=>new this.model(d))
        : new this.model(doc);
    }

    //if not present in cache then store in redis & return value
    const result = await exec.apply(this,arguments);
    client.hset(this.hashKey, key, JSON.stringify(result), 'EX', 10);
    return result;
};

module.exports = {
    clearHash(hashKey){
        client.del(JSON.stringify(hashKey));
    }
};