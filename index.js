"use strict"

class UI {
    constructor(username) {
        this.broadcaster = username.toLowerCase()
        this.emoteCdn = id => `https://static-cdn.jtvnw.net/emoticons/v1/${id}/1.0`
        this.mainChatSection = document.querySelector('[chat-section]')
        this.chatSection = document.querySelector('[chat-section]>[chat-section]')
        this.chatLimit = 500
        this.deleteChatLimitMsg = 1
        this.isScrollable = true
        this.lastScrollPosition = 0
        this._resizeScroller = this.resizeScroller()
        this._scroller = this.scroller()
    }

    scroller() {
        this.mainChatSection.addEventListener('scroll', () => {
            // scroll top checker
            const currentScroll = this.mainChatSection.scrollTop
            if(currentScroll < this.lastScrollPosition) {
                this.isScrollable = false
            } 
            this.lastScrollPosition = currentScroll 
            // we are in the end of chat
            if(~~(this.mainChatSection.scrollTop + this.mainChatSection.clientHeight) >= 
            ~~(this.mainChatSection.scrollHeight - this.chatSection.lastChild.clientHeight + 1)){
                this.isScrollable = true
            }
        })
    }
    scrollToEnd() {
        this.mainChatSection.scrollTop = 
        this.mainChatSection.scrollHeight - this.mainChatSection.clientHeight
    }
    resizeScroller() {
        new ResizeObserver(_ => {
            if(this.isScrollable)
                this.scrollToEnd()
          }).observe(this.chatSection)
    }
    createChatComponent(data) {
        const { color, displayname, userid, usertype, emotes, badges, systemmsg } = data
        
        const div = document.createElement('div')
        div.setAttribute('userId', userid)
        div.setAttribute('chat', '')

        const username = document.createElement('a')
        username.textContent = displayname || systemmsg
        username.style.color = color || 'white'
        username.setAttribute('username', '')
        username.setAttribute('isMod', badges?.includes("moderator") ? '1' : '0')
        username.setAttribute('isBroadcaster', badges?.includes("broadcaster") ? '1' : '0')
        username.setAttribute('href', `https://twitch.com/${displayname}`)
        username.setAttribute('target','_blank')

        const msg = document.createElement('span')
        msg.innerHTML = ': ' + this.pushEmotes(this.emoteParser(emotes), this.message(usertype))
        this.message(usertype)?.toLowerCase().includes(`@${this.broadcaster}`) ? div.style.background = '#a95d27' : ''

        msg.setAttribute('msg', '')
        
        
        div.appendChild(username)
        div.appendChild(msg)
        return div
    }
    removeOldChats() {
        if (this.chatSection.childNodes.length + this.deleteChatLimitMsg
         >= this.chatLimit){
            for (let i = 1; i <= this.deleteChatLimitMsg; i++){
                this.chatSection.childNodes[0].remove()
            }
            if(this.isScrollable) this.scrollToEnd()
        }
    }
    updateChatUI(receivedData) {   
        this.chatSection.append(this.createChatComponent(
            receivedData
        ))
        this.removeOldChats()     
    }
    pushEmotes(emotesAndPosition, message) {
        var originalMsg = message
        emotesAndPosition.map((_emotesAndPosition) => {
            var emoteId = _emotesAndPosition[0]
            var positions = _emotesAndPosition[1].split(',')
            positions.map((position) => {
                var emoteName = originalMsg.slice(position.split('-')[0], parseInt(position.split('-')[1]) + 1)
                message = message.replaceAll(emoteName, `<img src='${this.emoteCdn(emoteId)}'>`)
            })
        })
        return message
    }
    emoteParser(emotesAndPosition) {
        if(emotesAndPosition == null) return []
        var emotesAndPosition = emotesAndPosition.split('/').map((emote) => {
            return emote
        })
        return emotesAndPosition.map((emotesAndPosition) => {
            return emotesAndPosition.split(':')
        })
    }
    message(dumbMessage) {
        return dumbMessage.split(`PRIVMSG #${this.broadcaster} :`)[1]
    }
}

class TWITCH_WS {
    constructor(server, username){
        this.server   = server
        this.username = username
        this._socket = null
        this.anonymouse_user = `justinfan${Math.floor(Math.random() * 10000)}`
    }
    ws_commands() { 
        return {
            1: 'CAP REQ :twitch.tv/tags twitch.tv/commands',
            2: `NICK ${this.anonymouse_user}`,
            3: `JOIN #${this.username.toLowerCase()}`
        }
    }
    set setScoket(socket) {
        this._socket = socket 
     }
    connect() {
        var socket = new WebSocket(this.server)
        var _this = this
        socket.onopen = async () => {
            console.log('connected to server')
            var commands = _this.ws_commands()
            await socket.send(commands["1"])
            await socket.send(commands["2"])
            await socket.send(commands["3"])
            this._socket = socket
            this.info_receiver()
        }
        return socket
    }
    info_receiver() {
        console.log('receiving data from the connected server')
        const ui = new UI(this.username)
        this._socket.onmessage = (event) => {
            if (this.isChatMsg(event.data)){
                ui.updateChatUI(this.parse_data(event.data))
        this._socket.onclose = (event) => {
                console.log('connection closed')
             }
        }
        if (event.wasClean) {
            //alert(`connection closed cleanly, code=${event.code} reason=${event.reason}`)
            } 
        }
    }
    getInfo(data, name) {
        var indexInfo = data.indexOf(name)+name.length+1
        return data.slice(indexInfo).split(';')[0] || null
    }
    _getInfo(data, requiredInfo) {
        var info = { }
        requiredInfo.map(item =>{
            info[item.replace('-', '')] = this.getInfo(data, item)
        })
        return info
    }
    parse_data(data) {
        var finalData = 
        this._getInfo(data, ["color", "display-name", "user-id", "user-type", "emotes", "badges", "system-msg"])
        return { ...finalData }
    }
    isChatMsg(data) {
        return data.startsWith('@badge-info')
    }
}

const streamer = document.querySelector('[username-inp]')
const streamer_username = document.querySelector('[change-username]')
const open_sockets = []
streamer_username.addEventListener('click', () => {
    open_sockets.map((_socket) => {
        _socket.close()
        open_sockets.shift(_socket)
    })
    const Twitch_Ws = new TWITCH_WS('wss://irc-ws.chat.twitch.tv/',
                                streamer.value)

    const socket = Twitch_Ws.connect()
    open_sockets.push(socket)
})