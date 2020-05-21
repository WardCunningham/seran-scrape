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
        let t0 = Date.now()
        console.log('run',this.run)
        this.run().then(() => {
          console.log('done',this.run)
          this.running=false;
          this.status=`complete in ${(Date.now()-t0)/1000} seconds`
        });
      } else if (this.waiting) {
        this.waiting = null;
        this.running = true
        console.log('resume',this.run)
        this.resume()
      }
    }

    if (req.url.indexOf("step") != -1) {
      console.log('step',this.run)
      if (this.running) {
        this.running = false;
      } else if (this.waiting) {
        this.waiting = null;
        await sleep(30)
        this.resume()
      }
    }

    if (req.url.indexOf("stop") != -1) {
      console.log('stop',this.run)
      if (this.running) {
        this.running = false;
      }
    }

    wiki.serveJson(req, {
      running: this.running,
      waiting: !!this.waiting,
      status: this.status
    });

    return true
  }

  register(handler) {
    handler.route(`/${this.name}\\?action=start`, (req, _system) => this.button(req, _system))
    handler.route(`/${this.name}\\?action=stop`, (req, _system) => this.button(req, _system))
    handler.route(`/${this.name}\\?action=step`, (req, _system) => this.button(req, _system))
    handler.route(`/${this.name}\\?action=state`, (req, _system) => this.button(req, _system))
    return this
  }
}

