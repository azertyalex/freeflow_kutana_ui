import socketService from '../services/socketService'
export default {
  state: {
    messages: []
  },
  mutations: {
    setMessages(state, messages) {
      state.messages = messages
    },
    addMessage(state, message) {
      console.log(message)
      state.messages.push(message)
    }
  },
  actions: {
    getMessages(context) {
      // TODO: get messages
      let messages = []
      context.commit("setMessages", messages)
    },
    sendMessage(context, message) {
      socketService.sendMessage(message)
      // context.commit("addMessage", message)
    },
    SOCKET_message(context, message) {
      console.log(`dddd`)
      context.commit("addMessage", message)
    }
  },
  getters: {
    messages: state => state.messages
  },
}
