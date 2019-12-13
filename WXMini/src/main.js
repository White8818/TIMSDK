import Vue from 'mpvue'
import TIMApp from './App'
import TIM from 'tim-wx-sdk'
import store from './store/index'

import COS from 'cos-wx-sdk-v5'
import { SDKAPPID } from '../static/utils/GenerateTestUserSig'
import TYPES from './utils/types'
const tim = TIM.create({
  SDKAppID: SDKAPPID
})
tim.setLogLevel(0)
wx.$app = tim
wx.$app.registerPlugin({'cos-wx-sdk': COS})

let $bus = new Vue()
Vue.prototype.TIM = TIM
Vue.prototype.$type = TYPES
Vue.prototype.$store = store
Vue.prototype.$bus = $bus

tim.on(TIM.EVENT.SDK_READY, onReadyStateUpdate, this)
tim.on(TIM.EVENT.SDK_NOT_READY, onReadyStateUpdate, this)

tim.on(TIM.EVENT.KICKED_OUT, event => {
  store.commit('resetGroup')
  store.commit('resetUser')
  store.commit('resetCurrentConversation')
  store.commit('resetAllConversation')
  wx.showToast({
    title: '你已被踢下线',
    icon: 'none',
    duration: 1500
  })
  setTimeout(() => {
    wx.reLaunch({
      url: '../login/main'
    })
  }, 1500)
})

// 出错统一处理
tim.on(TIM.EVENT.ERROR, event => {
  // 网络错误不弹toast && sdk未初始化完全报错
  if (event.data.message && event.data.code && event.data.code !== 2800 && event.data.code !== 2999) {
    store.commit('showToast', {
      title: event.data.message,
      duration: 2000
    })
  }
})

tim.on(TIM.EVENT.MESSAGE_RECEIVED, event => {
  for (let i = 0; i < event.data.length; i++) {
    let item = event.data[i]
    if (item.type === TYPES.MSG_GRP_TIP) {
      if (item.payload.operationType) {
        $bus.$emit('groupNameUpdate', item.payload)
      }
    }
    if (item.type === TYPES.MSG_CUSTOM) {
      const videoCustom = JSON.parse(item.payload.data)
      if (videoCustom.version === 3) {
        switch (videoCustom.action) {
          // 对方呼叫我
          case 0:
            if (!store.getters.isCalling) {
              let url = `../call/main?args=${item.payload.data}&&from=${item.from}&&to=${item.to}`
              wx.navigateTo({url})
            } else {
              $bus.$emit('isCalling', item)
            }
            break
          // 对方取消
          case 1:
            wx.navigateBack({
              delta: 1
            })
            break
          // 对方拒绝
          case 2:
            $bus.$emit('onRefuse')
            break
          // 对方不接1min
          case 3:
            wx.navigateBack({
              delta: 1
            })
            break
          // 对方接听
          case 4:
            $bus.$emit('onCall', videoCustom)
            break
          // 对方挂断
          case 5:
            $bus.$emit('onClose')
            break
          // 对方正在通话中
          case 6:
            $bus.$emit('onBusy')
            break
          default:
            break
        }
      }
    }
  }
  store.dispatch('onMessageEvent', event)
})
tim.on(TIM.EVENT.CONVERSATION_LIST_UPDATED, event => {
  store.commit('updateAllConversation', event.data)
})
tim.on(TIM.EVENT.GROUP_LIST_UPDATED, event => {
  store.commit('updateGroupList', event.data)
})
tim.on(TIM.EVENT.BLACKLIST_UPDATED, event => {
  store.commit('updateBlacklist', event.data)
})

tim.on(TIM.EVENT.GROUP_SYSTEM_NOTICE_RECEIVED, event => {
  const isKickedout = event.data.type === 4
  const isCurrentConversation =
    `GROUP${event.data.message.payload.groupProfile.groupID}` === store.state.conversation.currentConversationID
  // 在当前会话被踢，需reset当前会话
  if (isKickedout && isCurrentConversation) {
    wx.navigateBack({
      delta: 1
    })
    store.commit('resetCurrentConversation')
  }
})
function onReadyStateUpdate ({ name }) {
  const isSDKReady = (name === TIM.EVENT.SDK_READY)
  if (isSDKReady) {
    wx.hideLoading()
    wx.$app.getMyProfile().then(res => {
      store.commit('updateMyInfo', res.data)
    })
    wx.$app.getBlacklist().then(res => {
      store.commit('setBlacklist', res.data)
    })
  }
  store.commit('setSdkReady', isSDKReady)
}

new Vue({
  TIMApp
}).$mount()
