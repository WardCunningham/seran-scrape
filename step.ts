// Server-side start/stop/step support for process-step plugin

import * as wiki from "seran/wiki.ts"

export class ProcessStep {
  name: string
  status: string
  running: boolean
  waiting: any
  resume: any
  run: any

  constructor(name, running, run) {
    this.name = name
    this.status = 'beginning';
    this.running = running;
    this.waiting = null;
    this.resume = null;
    this.run = run;
  }

  async step(now) {
    this.status = now
    console.log(this.name, now)
    if (!this.running) {
      return this.waiting = new Promise(resolve => {
        this.resume = resolve
      })
    } else {
      return null
    }
  }


  async button(req, _system) {
    let headers = wiki.baseHeaders();

    async function sleep(ms) {
      return new Promise(resolve => {
        setTimeout(resolve, ms);
      });
    }

    if (req.url.indexOf("start") != -1) {
      console.log('start')
      if (!this.running && !this.waiting) {
        this.running = true
        console.log('run',this.run)
        this.run().then((dt) => {
          console.log('done', dt)
          this.running=false;
          this.status=`complete in ${dt} seconds`
        });
      } else if (this.waiting) {
        this.waiting = null;
        this.running = true
        console.log('resume')
        this.resume()
      }
    }

    if (req.url.indexOf("step") != -1) {
      console.log('step')
      if (this.running) {
        this.running = false;
      } else if (this.waiting) {
        this.waiting = null;
        await sleep(30)
        this.resume()
      }
    }

    if (req.url.indexOf("stop") != -1) {
      console.log('stop')
      if (this.running) {
        this.running = false;
      }
    }

    wiki.serveJson(req, {
      running: this.running,
      waiting: !!this.waiting,
      status: this.status
    });
  }

  control(metaPages) {

    function route(url, fn) {
      metaPages[url] = fn;
    }

    route(`/${this.name}?action=start`, (a,b) => this.button(a,b));
    route(`/${this.name}?action=stop`, (a,b) => this.button(a,b));
    route(`/${this.name}?action=step`, (a,b) => this.button(a,b));
    route(`/${this.name}?action=state`, (a,b) => this.button(a,b));

    return this
  }
}

