<p align="center">
  <h1 align="center">Paiboi</h1>
    <p align="center">:globe_with_meridians: Make Ajit Pai Memes</p>
    <p align="center">
    <img src = "https://i.imgur.com/otkdsMd.gif">
    </p>
</p>

## Usage

Visit https://paiboi.herokuapp.com on Chrome, Firefox or a browser that supports webm videos

- Paste a YouTube video
- Move the playhead around to start looping a five second section of your video
- Touch or click to move Pai around
- Make it!

## Prerequisites

- Node.js is installed
- [FFmpeg](https://johnvansickle.com/ffmpeg/) is installed and added to your OS path
- You have an AMQP server, for example https://www.cloudamqp.com/
- You have an [S3 Bucket](https://aws.amazon.com/s3/)

## Installation

Paiboi can be installed by running:

```
git clone https://github.com/spookyUnknownUser/Paiboi/
cd Paiboi
npm install
```

Further, several environmental variables containing your S3 access keys and AMQP configuration will have to be set

```
AMQP_URL=<your_url>
QUEUE=<your_queue_name>
BUCKET=<your_bucket_name>
S3_KEY=<your_key>
S3_SECRET=<your_secret>
```

Optionally a `GFYCAT_CLIENT_ID` and  `GFYCAT_CLIENT_SECRET` can also be set for Gfycat uploads. You can finally run the following simultaneously to bring the site up locally

```javascript
npm run worker:dev
npm run start:dev
```

## Background

Paiboi uses FFmpeg to overlay a .webm with alpha transparency on top of a background video. The background video comes from YouTube at the moment but could potentially come from anywhere. However, the webm needs to be specifically encoded in VP9 and played back on a browser supporting [webm with alpha transparency](https://developers.google.com/web/updates/2013/07/Alpha-transparency-in-Chrome-video).

The core of app could function by just using an FFmpeg command to overlay a webm with alpha on top of another video, as described by [Mulvya](https://superuser.com/users/114058/mulvya) on https://superuser.com/a/1153268/450105

```
ffmpeg -i base.mp4 -c:v libvpx -i overlay.webm -filter_complex overlay output.mp4
```

However, to additionally move the overlay around we need another FFmpeg filter also described by Mulvya in https://superuser.com/a/1100429/450105

```
ffmpeg -i input1 -i input2
 -filter_complex '[1][0]scale2ref=oh*mdar:ih[2nd][ref];[ref][2nd]vstack'
 -map [vid] -c:v libx264 -crf 23 -preset veryfast output
```

Together, when used with the awesome [Fluent FFmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg), we get something that looks like:

```javascript
function renderVideo(downloadedVideo) {
    return new Promise((resolve, reject) => {
        ffmpeg(downloadedVideo.absoluteInput)
            .input('./public/videos/overlay.webm')
            .inputOption('-c:v libvpx-vp9')
            .complexFilter([{
                    filter: 'scale2ref',
                    options: 'oh*mdar:ih*.9',
                    inputs: ['1', '0'],
                    outputs: ['scaled', 'ref']
                },
                {
                    filter: 'overlay',
                    options: { x: `main_w*${downloadedVideo.xOffset || 0}`, y: 'H-h', shortest: '1' },
                    inputs: ['ref', 'scaled'],
                    outputs: ['composite']
                }
            ], 'composite')
            .on('end', () => {
                resolve(downloadedVideo)
            })
            .save(downloadedVideo.absoluteOutput);
    })
}
```

Because there is a lot of video work going on including downloading, encoding and uploading - a worker system is needed to separate out the more compute intensive parts of the application. By using [rabbitmq](https://www.rabbitmq.com/) we can host the power hungry parts on something like Amazon's EC2 and the less intense frontend on Heroku. Not only is this cheaper, but it's much easier to scale up and down. All of this is tied up with a sprinkle of [Socket.io](https://socket.io/) to notify clients when work is done.

All of the above can mainly be found under `/workers/`

Lastly [Tachyons](http://tachyons.io/) is used for CSS. I realise that this might make the html look messy, but I've found it to be extremely helpful in making sites as fast as possible.

## Deployment

I've been using CodeDeploy and an Auto Scaling group on Amazon AWS to host the workers and a free Heroku tier to host the frontend. While this is completely optional, you can tell the repo has some files for these services. Specifically the `/scripts/` directory and [appspec.yml](appspec.yml) file for amazon - with the Procfile for Heroku. It would certainly be less of a hassle to just deploy to Heroku, but this is far too expensive IMO, especially with the existence of the AWS free tier.

To deploy this yourself the easiest thing to do would be signing up for a free AWS, Heroku account and then just using the default configuration. However, you could just as easily deploy this on any server with the production commands.

```
npm run start
npm run worker
```

Of course, before this you will need to have installed the perquisites and the application.

## Built With
* [interact.js](http://interactjs.io/)
* [Socket.io](https://socket.io/)
* [FFmpeg](https://www.ffmpeg.org/)
* [Fluent FFmpeg](https://github.com/fluent-ffmpeg/node-fluent-ffmpeg)
* [ytdl](https://github.com/fent/node-ytdl-core)
* [plyr](https://plyr.io/)
* [Tachyons](http://tachyons.io/)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for details but tl;dr YES!

## Versioning

Using [SemVer](http://semver.org/) for versioning.

## Authors

Me

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## Papa Bless

* h3h3productions for [cutting the video of Pai](https://www.youtube.com/watch?v=5uXsCaakZD8)
* [Mulvya](https://superuser.com/users/114058/mulvya) for writing the core FFmpeg of this app
* [Material Icons](https://material.io/icons/#ic_video_library) for favicon
* [@reallynattu](https://twitter.com/reallynattu) for the loading spinner
