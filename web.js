
const express = require('express');
const fs = require('fs');
const multer = require('multer');
const { MongoClient, ObjectId } = require('mongodb');
const ejs = require('ejs');
const mongodb = require('mongodb');

const app = express();
const upload = multer({
    dest: 'uploads/',
    fileFilter: (req, file, cb) => {
      if (file.mimetype !== 'video/mp4') {
        return cb(new Error('Invalid file type. Only .mp4 videos are allowed.'));
      }
      cb(null, true);
    },
  });
  


const mongoURL = 'mongodb://localhost:27017';
const dbName = 'video_app';

let db;
let videosCollection;
let gridFSBucket;


MongoClient.connect(mongoURL, { useUnifiedTopology: true })
  .then((client) => {
    db = client.db(dbName);
    videosCollection = db.collection('videos');
    gridFSBucket = new mongodb.GridFSBucket(db, { bucketName: 'videos' });
    console.log('Connected to MongoDB');
  })
  .catch((err) => console.error('Error connecting to MongoDB:', err));

app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');


app.get('/', async function (req, res) {
  try {
    // Fetch all videos from MongoDB collection
    const videos = await videosCollection.find().toArray();

    // Render the index.ejs template and pass the videos array to it
    res.render('home', { videos });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching videos' });
  }
});



app.get('/videoplayer/:videoId', async function (req, res) {
    try {
      const videoId = req.params.videoId;
  
      
      if (!ObjectId.isValid(videoId)) {
        return res.status(400).json({ message: 'Invalid videoId' });
      }
  
      const videoStream = gridFSBucket.openDownloadStream(new ObjectId(videoId));
  
      videoStream.on('error', () => {
        res.status(404).json({ message: 'Video not found' });
      });
  

      res.setHeader('Content-Type', 'video/mp4');
  
    
      videoStream.pipe(res);
    } catch (error) {
      res.status(500).json({ message: 'Error streaming video' });
    }
  });
  
  
  app.post('/vote', express.json(), async function (req, res) {
    const videoId = req.body.videoId;
  
    try {
   
      if (!ObjectId.isValid(videoId)) {
        return res.status(400).json({ message: 'Invalid videoId' });
      }
  
      // Check if the video with the given videoId exists
      const video = await videosCollection.findOne({ _id: new ObjectId(videoId) });
  
      if (!video) {
        return res.status(404).json({ message: 'Video not found' });
      }
  
      // Increment the vote count for the video
      await videosCollection.updateOne({ _id: new ObjectId(videoId) }, { $inc: { votes: 1 } });
  
      res.json({ message: 'Vote added successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Error voting for the video' });
    }
  });

  app.post('/upload', upload.single('video'), async function (req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No video file uploaded' });
      }
  
      const videoPath = req.file.path;
      const videoSize = req.file.size;
      const title = req.body.title || 'Untitled Video';
  
      const gridFSBucket = new mongodb.GridFSBucket(db, {
        bucketName: 'videos',
      });
  
      const videoReadStream = fs.createReadStream(videoPath);
  
      const uploadStream = gridFSBucket.openUploadStream(title);
      videoReadStream.pipe(uploadStream);
  
      uploadStream.on('error', () => {
        res.status(500).json({ message: 'Error uploading video' });
      });
  
      uploadStream.on('finish', () => {
        fs.unlinkSync(videoPath); // Remove the temporary file
  
        const videoDoc = {
          title,
          videoId: uploadStream.id,
          size: videoSize,
          votes: 0,
        };
  
        videosCollection.insertOne(videoDoc, (err, result) => {
          if (err) {
            res.status(500).json({ message: 'Error saving video information' });
          } else {
            res.json({ message: 'Video uploaded successfully', videoId: result.insertedId });
          }
        });
      });
    } catch (error) {
      res.status(500).json({ message: 'Error uploading video' });
    }
  });
  


// const videoIdToDelete = ObjectId(); 
// db.fs.files.deleteOne({ _id: "64c12b3aa839d2dcaef23eaa" });
// db.getCollection('videos.files').deleteOne({ _id: "64c12b3aa839d2dcaef23eaa"  });
// db.getCollection('videos.chunks').deleteMany({ files_id: videoIdToDelete });
// db.fs.chunks.deleteMany({ files_id: videoIdToDelete });
// db.fs.files.deleteOne({ _id: videoIdToDelete });
  
  app.listen(5000, () => {
    console.log('Server is running on port 5000');
  });
  