import type { Socket } from "socket.io-client"
import type { RoomState } from "$/room"
import type { BackendEmits, FrontendEmits, RoomEmit } from "$/socket"

import { Ref, ref, watch } from "vue"
import { bufferedStub, capitalize, debug, ls } from "./util"
import { MediaSourceAny } from "$/mediaSource"

const log = debug("resync.ts")

export type SocketOff = () => void
export type ResyncSocket = Socket<BackendEmits, FrontendEmits>

export default class Resync {
  private socket: ResyncSocket
  private roomEmit: RoomEmit
  private handlers: SocketOff[] = []
  currentTime = (): number => NaN
  duration = (): number => NaN
  buffered = (): HTMLMediaElement["buffered"] => bufferedStub

  paused = ref(true)
  volume = ref(ls("resync-volume") ?? 0.1)
  muted = ref(ls("resync-muted") ?? false)
  state: Ref<RoomState>

  constructor(socket: Socket, roomID: string) {
    this.socket = socket
    this.roomEmit = (event, arg, ...args) => {
      log.extend("roomEmit")(event, { roomID, ...arg }, ...args)
      socket.emit(event, { roomID, ...arg }, ...args)
    }

    this.state = ref({
      paused: this.paused.value,
      source: undefined,
      lastSeekedTo: 0,
      members: [],
      membersLoading: 0,
      queue: [],
    })

    this.handlers.push(
      watch(this.volume, volume => {
        ls("resync-volume", volume)
      }),
      watch(this.muted, muted => {
        ls("resync-muted", muted)
      }),
      this.onState(state => {
        log("new state", state)
        this.state.value = state
      })
    )
  }
  destroy = (): void => this.handlers.forEach(off => off())

  private eventHandler<E extends keyof BackendEmits>(event: E) {
    return (fn: BackendEmits[E]): SocketOff => {
      // @ts-expect-error I am clueless as to why this errors
      this.socket.on(event, fn)
      log(`registered on${capitalize(event)} handler`)

      return () => {
        this.socket.off(event, fn)
        log(`unregistered on${capitalize(event)} handler`)
      }
    }
  }

  static getNewRandom = (socket: ResyncSocket): Promise<string> => {
    return new Promise(res => {
      socket.emit("getNewRandom", res)
    })
  }

  search = (query: string): Promise<MediaSourceAny[]> => {
    return new Promise(res => this.socket.emit("search", query, res))
  }

  joinRoom = async (name: string): Promise<void> => {
    const join = () => {
      return new Promise<void>(res => {
        this.roomEmit("joinRoom", { name }, state => {
          log("initial room state", state)
          this.state.value = state

          res()
        })
      })
    }

    const connect = () => {
      this.socket.off("connect", connect)
      join()
    }

    const disconnect = () => {
      this.socket.on("connect", connect)
    }

    this.socket.on("disconnect", disconnect)

    this.handlers.push(() => this.socket.off("disconnect", disconnect))
    this.handlers.push(() => this.roomEmit("leaveRoom"))

    await join()
  }

  playContent = (source: string): void => this.roomEmit("playContent", { source })
  queue = (source: string): void => this.roomEmit("queue", { source })
  playQueued = (index: number): void => this.roomEmit("playQueued", { index })
  clearQueue = (): void => this.roomEmit("clearQueue")
  removeQueued = (index: number): void => this.roomEmit("removeQueued", { index })
  loaded = (): void => this.roomEmit("loaded")
  finished = (): void => this.roomEmit("finished")
  pause = (currentTime: number): void => this.roomEmit("pause", { currentTime })
  resume = (): void => this.roomEmit("resume")
  seekTo = (currentTime: number): void => this.roomEmit("seekTo", { currentTime })
  resync = (): void => this.roomEmit("resync")

  playbackError = (error: { reason: string; name: string }, currentTime: number): void => {
    this.roomEmit("playbackError", { ...error, currentTime })
  }
  onSource = this.eventHandler("source")
  onPause = this.eventHandler("pause")
  onResume = this.eventHandler("resume")
  onSeekTo = this.eventHandler("seekTo")
  onRequestTime = this.eventHandler("requestTime")
  onNotify = this.eventHandler("notifiy")
  onState = this.eventHandler("state")
}
