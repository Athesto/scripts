
//Version: 1741492905

downloader = {
  audios: [],
  videos: [],

  stripURL: function(url) {
    const entries = ["range", "ump", "srfvp"];
    entries.forEach(entry => url.searchParams.delete(entry));
    return url;
  },

  validateScope: function(){
    if (window.top === window.self){
      throw new DOMException("Top level found, please change the scope to the video ex:embed/")
    }
  },

  getUrls: function() {
    this.validateScope()
    const urls = performance
      .getEntries()
      .filter(entry => entry.initiatorType === "fetch")
      .map(x => new URL(x.name))
      .map(url => this.stripURL(url));

    this.videos = urls.filter(x => x.searchParams.get("mime") === "video/mp4");
    if (this.videos.length == 0) {
      console.warn("No video Found")
    }
    this.audios = urls.filter(x => x.searchParams.get("mime") === "audio/mp4");
    if (this.audios.length == 0) {
      console.warn("No video Found")
    }

    return { videos: this.videos, audios: this.audios };
  },

  openVideo: function(index = 0) {
    if (this.videos && this.videos.length > index) {
      window.open(this.videos[index]);
    } else {
      console.warn("No videos available or index out of range.");
    }
  },

  openAudio: function(index = 0) {
    if (this.audios && this.audios.length > index) {
      window.open(this.audios[index]);
    } else {
      console.warn("No audios available or index out of range.");
    }
  }
};

// First, fetch the URLs before opening any video/audio
//downloader.getUrls();
//downloader.openVideo();