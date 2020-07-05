const mongoose = require('mongoose');
const requireLogin = require('../middlewares/requireLogin');

const Blog = mongoose.model('Blog');

module.exports = app => {
  app.get('/api/blogs/:id', requireLogin, async (req, res) => {
    const blog = await Blog.findOne({
      _user: req.user.id,
      _id: req.params.id
    });

    res.send(blog);
  });

  app.get('/api/blogs', requireLogin, async (req, res) => {
    const redis = require('redis');
    const redisURL = 'redis://127.0.0.1:6379';
    const client = redis.createClient(redisURL);
    const util = require('util');
    // returns promisified func for the supplied func, so that you do not need to use callbacks 
    client.get = util.promisify(client.get);

    //checking cached data available w.r.t query / request
    const cachedBlogs = await client.get(req.user.id);
    
    //if cached data found sent it
    if(cachedBlogs){
      console.log('Serving from CACHE');
      return res.send(JSON.parse(cachedBlogs));
    }

    //if cached data not found then send & cache it
    const blogs = await Blog.find({ _user: req.user.id });
    console.log('Serving from MongoDB');
    res.send(blogs);
    client.set(req.user.id, JSON.stringify(blogs));
  });

  app.post('/api/blogs', requireLogin, async (req, res) => {
    const { title, content } = req.body;

    const blog = new Blog({
      title,
      content,
      _user: req.user.id
    });

    try {
      await blog.save();
      res.send(blog);
    } catch (err) {
      res.send(400, err);
    }
  });
};
