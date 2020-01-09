import Vue from "vue"
import app from "./app.vue"
import router from "./router"
import store from "./store"
// import "./registerServiceWorker"
import io from "socket.io-client"
import VueYoutube from "vue-youtube"

import * as Sentry from "@sentry/browser"
import * as Integrations from "@sentry/integrations"

Sentry.init({
  dsn: "https://8bfe86f5c97c45e69725e133ddc95e1d@sentry.io/1875610",
  integrations: [
    new Integrations.Vue({ Vue, attachProps: true, logErrors: true }),
  ],
})

Sentry.configureScope(function(scope) {
  scope.setUser({ username: store.state.name || "no name set yet" })
})

const dev = process.env.NODE_ENV === "development"

const socket = dev
  ? io(`http://${location.hostname}:1169`)
  : io("https://colo.vaaski.com", { path: "/w2g" })

if (dev) socket.on("connect", () => socket.emit("dev"))

Vue.use(VueYoutube)

Vue.socket = Vue.prototype.socket = socket
Vue.config.productionTip = false

new Vue({
  router,
  store,
  render: h => h(app),
}).$mount("#app")
