import dayjs from '../../base/dayjs';
import logger from '../../../utils/logger';
import constant from '../../../utils/constant';
// eslint-disable-next-line no-undef
const app = getApp();
// eslint-disable-next-line no-undef
Component({
  /**
   * 组件的属性列表
   */
  properties: {
    conversation: {
      type: Object,
      value: {},
      observer(newVal) {
        if (!newVal.conversationID) return;
        this.setData({
          conversation: newVal,
        }, () => {
          this.getMessageList(this.data.conversation);
        });
      },
    },
    unreadCount: {
      type: Number,
      value: '',
      observer(newVal) {
        this.setData({
          unreadCount: newVal,
        });
      },
    },
  },

  /**
   * 组件的初始数据
   */
  data: {
    avatar: '',
    userID: '',
    isLostsOfUnread: false,
    unreadCount: '',
    conversation: {}, // 当前会话
    messageList: [],
    // 自己的 ID 用于区分历史消息中，哪部分是自己发出的
    scrollView: '',
    triggered: true,
    nextReqMessageID: '', // 下一条消息标志
    isCompleted: false, // 当前会话消息是否已经请求完毕
    messagepopToggle: false,
    messageID: '',
    checkID: '',
    selectedMessage: {},
    deleteMessage: '',
    RevokeID: '', // 撤回消息的ID用于处理对方消息展示界面
    showName: '',
    showDownJump: false,
    showUpJump: false,
    jumpAim: '',
    messageIndex: '',
    isShow: false,
    Show: false,
    UseData: '',
    chargeLastmessage: '',
    groupOptionsNumber: '',
    showNewMessageCount: [],
    messageTime: '',
    messageHistoryTime: '',
    messageTimeID: {},
    showMessageTime: false,
    showMessageHistoryTime: false,
    showMessageError: false,
    personalProfile: {},
    showPersonalProfile: false,
    resendMessage: {},
    showOnlyOnce: false,
    lastMessageSequence: '',
    isRewrite: false,
    isMessageTime: {},
    firstTime: Number,
    newArr: {},
    errorMessage: {},
    errorMessageID: '',
  },

  lifetimes: {
    attached() {
    },
    ready() {
      if (this.data.unreadCount > 12) {
        if (this.data.unreadCount > 99) {
          this.setData({
            isLostsOfUnread: true,
            showUpJump: true,
          });
        } else {
          this.setData({
            showUpJump: true,
          });
        }
      }
      wx.$TUIKit.getMyProfile().then((res) => {
        this.data.avatar = res.data.avatar;
        this.data.userID = res.data.userID;
      });
      wx.$TUIKit.on(wx.$TUIKitEvent.MESSAGE_RECEIVED, this.$onMessageReceived, this);
      wx.$TUIKit.on(wx.$TUIKitEvent.MESSAGE_READ_BY_PEER, this.$onMessageReadByPeer, this);
      wx.$TUIKit.on(wx.$TUIKitEvent.MESSAGE_REVOKED, this.$onMessageRevoked, this);
    },

    detached() {
      // 一定要解除相关的事件绑定
      wx.$TUIKit.off(wx.$TUIKitEvent.MESSAGE_RECEIVED, this.$onMessageReceived);
      wx.$TUIKit.off(wx.$TUIKitEvent.MESSAGE_READ_BY_PEER, this.$onMessageReadByPeer);
      wx.$TUIKit.off(wx.$TUIKitEvent.MESSAGE_REVOKED, this.$onMessageRevoked);
    },
  },

  methods: {
    // 刷新消息列表
    refresh() {
      if (this.data.isCompleted) {
        this.setData({
          isCompleted: true,
          triggered: false,
        });
        return;
      }
      this.getMessageList(this.data.conversation);
      setTimeout(() => {
        this.setData({
          triggered: false,
        });
      }, 2000);
    },
    // 获取消息列表
    getMessageList(conversation) {
      if (!this.data.isCompleted) {
        wx.$TUIKit.getMessageList({
          conversationID: conversation.conversationID,
          nextReqMessageID: this.data.nextReqMessageID,
          count: 15,
        }).then((res) => {
          this.showMoreHistoryMessageTime(res.data.messageList);
          const { messageList } = res.data; // 消息列表。
          this.data.nextReqMessageID = res.data.nextReqMessageID; // 用于续拉，分页续拉时需传入该字段。
          this.data.isCompleted = res.data.isCompleted; // 表示是否已经拉完所有消息。
          this.data.messageList = [...messageList, ...this.data.messageList];
          if (messageList.length > 0 && this.data.messageList.length < this.data.unreadCount) {
            this.getMessageList(conversation);
          }
          this.$handleMessageRender(this.data.messageList, messageList);
        });
      }
    },
    // 历史消息渲染
    $handleMessageRender(messageList, currentMessageList) {
      this.showHistoryMessageTime(currentMessageList);
      for (let i = 0; i < messageList.length; i++) {
        if (messageList[i].flow === 'out') {
          messageList[i].isSelf = true;
        }
      }
      if (messageList.length > 0) {
        if (this.data.conversation.type === '@TIM#SYSTEM') {
          this.filterRepateSystemMessage(messageList);
        } else {
          this.setData({
            messageList,
            // 消息ID前拼接字符串为了解决scroll-into-view，无法跳转以数字开头的ID。
            jumpAim: `ID-${this.filterSystemMessageID(currentMessageList[currentMessageList.length - 1].ID)}`,
          }, () => {
          });
        }
      }
    },
    // 系统消息去重
    filterRepateSystemMessage(messageList) {
      const noRepateMessage = [];
      for (let index = 0;  index < messageList.length; index++) {
        if (!noRepateMessage.some(item => item && item.ID === messageList[index].ID)) {
          noRepateMessage.push(messageList[index]);
        }
      }
      this.setData({
        messageList: noRepateMessage,
      });
    },
    // 消息已读更新
    $onMessageReadByPeer() {
      this.setData({
        messageList: this.data.messageList,
      });
    },
    // 收到的消息
    $onMessageReceived(value) {
      const { businessID_text, messageType_text } = constant;
      this.messageTimeForShow(value.data[0]);
      this.setData({
        UseData: value,
      });
      value.data.forEach((item) => {
        if (item.conversationID === this.data.conversation.conversationID) {
        // 判断收到的消息是否是正在输入状态消息。由于正在输入状态消息是自定义消息，需要对自定义消息进行一个过滤，是自定义消息但不是正在输入状态消息，则新消息未读数加1，不是自定义消息则新消息未读数直接加1
          if (this.data.messageList.length > 12 && !value.data[0].isRead) {
            if (item.type === messageType_text.typeTIMCustomElem) {
              const typingMessage = JSON.parse(item.payload.data);
              if (typingMessage.businessID !== businessID_text.typeUserTyping) {
                this.data.showNewMessageCount.push(value.data[0]);
                this.setData({
                  showNewMessageCount: this.data.showNewMessageCount,
                  showDownJump: true,
                });
              }
            } else {
              this.data.showNewMessageCount.push(value.data[0]);
              this.setData({
                showNewMessageCount: this.data.showNewMessageCount,
                showDownJump: true,
              });
            }
          } else {
            this.setData({
              showDownJump: false,
            });
          }
        }
      });
      // 若需修改消息，需将内存的消息复制一份，不能直接更改消息，防止修复内存消息，导致其他消息监听处发生消息错误
      // 将收到的消息存入messageList之前需要进行过滤，正在输入状态消息不用存入messageList.
      const list = [];
      value.data.forEach((item) => {
        if (item.conversationID === this.data.conversation.conversationID && item.type === messageType_text.typeTIMCustomElem) {
          try {
            const typingMessage = JSON.parse(item.payload.data);
            if (typingMessage.businessID !== businessID_text.typeUserTyping) {
              list.push(item);
            } else {
              this.triggerEvent('typeMessage', {
                typingMessage,
              });
            }
          } catch (error) {
          }
        } else if (item.conversationID === this.data.conversation.conversationID) {
          list.push(item);
        }
      });
      this.data.messageList = this.data.messageList.concat(list);
      app.globalData.groupOptionsNumber = this.data.messageList.slice(-1)[0].payload.operationType;
      this.$onMessageReadByPeer();
      this.setData({
        messageList: this.data.messageList,
        groupOptionsNumber: this.data.messageList.slice(-1)[0].payload.operationType,
      });
      if (this.data.conversation.type === 'GROUP') {
        this.triggerEvent('changeMemberCount', {
          groupOptionsNumber: this.data.messageList.slice(-1)[0].payload.operationType,
        });
      }
    },
    // 自己的消息上屏
    updateMessageList(message) {
      const { businessID_text, messageType_text } = constant;
      this.$onMessageReadByPeer();
      this.messageTimeForShow(message);
      message.isSelf = true;
      if (message.type === messageType_text.typeTIMCustomElem) {
        const typingMessage = JSON.parse(message.payload.data);
        if (typingMessage.businessID === businessID_text.typeUserTyping) {
          this.setData({
            messageList: this.data.messageList,
          });
        } else {
          this.data.messageList.push(message);
        }
      } else {
        this.data.messageList.push(message);
      }
      this.setData({
        lastMessageSequence: this.data.messageList.slice(-1)[0].sequence,
        messageList: this.data.messageList,
        jumpAim: `ID-${this.filterSystemMessageID(this.data.messageList[this.data.messageList.length - 1].ID)}`,
      });
    },
    // 兼容 scrollView
    filterSystemMessageID(messageID) {
      const index = messageID.indexOf('@TIM#');
      const groupIndex = messageID.indexOf('@TGS#');
      if (index === 0) {
        messageID =  messageID.replace('@TIM#', '');
      }
      if (groupIndex === 0) {
        messageID =  messageID.replace('@TGS#', '');
      }
      return messageID;
    },
    // 获取消息ID
    handleLongPress(e) {
      for (let index = 0; index < this.data.messageList.length; index++) {
        if (this.data.messageList[index].status === 'success') {
          const { index } = e.currentTarget.dataset;
          this.setData({
            messageID: e.currentTarget.id,
            selectedMessage: this.data.messageList[index],
            Show: true,
          });
        }
      }
    },
    // 更新 messagelist
    updateMessageByID(deleteMessageID) {
      const { messageList } = this.data;
      const deleteMessageArr = messageList.filter(item => item.ID === deleteMessageID);
      this.setData({
        messageList,
      });
      return deleteMessageArr;
    },
    // 删除消息
    deleteMessage() {
      wx.$TUIKit.deleteMessage([this.data.selectedMessage])
        .then((imResponse) => {
          this.updateMessageByID(imResponse.data.messageList[0].ID);
          wx.showToast({
            title: '删除成功!',
            duration: 800,
            icon: 'none',
          });
        })
        .catch(() => {
          wx.showToast({
            title: '删除失败!',
            duration: 800,
            icon: 'error',
          });
        });
    },
    // 撤回消息
    revokeMessage() {
      wx.$TUIKit.revokeMessage(this.data.selectedMessage)
        .then((imResponse) => {
          this.setData({
            resendMessage: imResponse.data.message,
          });
          this.updateMessageByID(imResponse.data.message.ID);
          // 消息撤回成功
        })
        .catch((imError) => {
          wx.showToast({
            title: '超过2分钟消息不支持撤回',
            duration: 800,
            icon: 'none',
          }),
          this.setData({
            Show: false,
          });
          // 消息撤回失败
          console.warn('revokeMessage error:', imError);
        });
    },
    // 撤回消息重新发送
    resendMessage(e) {
      this.triggerEvent('resendMessage', {
        message: e.detail.message,
      });
    },
    // 关闭弹窗
    handleEditToggleAvatar() {
      this.setData({
        Show: false,
      });
    },
    // 向对方通知消息撤回事件
    $onMessageRevoked(event) {
      this.updateMessageByID(event.data[0].ID);
    },
    // 复制消息
    copyMessage() {
      wx.setClipboardData({
        data: this.data.selectedMessage.payload.text,
        success() {
          wx.getClipboardData({
            success(res) {
              logger.log(`| TUI-chat | message-list | copyMessage: ${res.data} `);
            },
          });
        },
      });
      this.setData({
        Show: false,
      });
    },
    // 消息跳转到最新
    handleJumpNewMessage() {
      this.setData({
        jumpAim: `ID-${this.filterSystemMessageID(this.data.messageList[this.data.messageList.length - 1].ID)}`,
        showDownJump: false,
        showNewMessageCount: [],
      });
    },
    // 消息跳转到最近未读
    handleJumpUnreadMessage() {
      if (this.data.unreadCount > 15) {
        this.getMessageList(this.data.conversation);
        this.setData({
          jumpAim: `ID-${this.filterSystemMessageID(this.data.messageList[this.data.messageList.length - this.data.unreadCount].ID)}`,
          showUpJump: false,
        });
      } else {
        this.getMessageList(this.data.conversation);
        this.setData({
          jumpAim: `ID-${this.filterSystemMessageID(this.data.messageList[this.data.messageList.length - this.data.unreadCount].ID)}`,
          showUpJump: false,
        });
      }
    },
    // 滑动到最底部置跳转事件为false
    scrollHandler() {
      this.setData({
        jumpAim: `ID-${this.filterSystemMessageID(this.data.messageList[this.data.messageList.length - 1].ID)}`,
        showDownJump: false,
      });
    },
    // 删除处理掉的群通知消息
    changeSystemMessageList(event) {
      this.updateMessageByID(event.detail.message.ID);
    },
    // 展示消息时间
    messageTimeForShow(messageTime) {
      const interval = 5 * 60 * 1000;
      const nowTime = Math.floor(messageTime.time / 10) * 10 * 1000;
      if (this.data.messageList.length > 0) {
        const lastTime = this.data.messageList.slice(-1)[0].time * 1000;
        if (nowTime  - lastTime > interval) {
          Object.assign(messageTime, {
            isShowTime: true,
          }),
          this.data.messageTime = dayjs(nowTime);
          this.setData({
            messageTime: dayjs(nowTime).format('YYYY-MM-DD HH:mm:ss'),
            showMessageTime: true,
          });
        }
      }
    },
    // 渲染历史消息时间
    showHistoryMessageTime(messageList) {
      const cut = 30 * 60 * 1000;
      for (let index = 0; index < messageList.length; index++) {
        const nowadayTime = Math.floor(messageList[index].time / 10) * 10 * 1000;
        const firstTime = messageList[0].time * 1000;
        if (nowadayTime - firstTime > cut) {
          const indexbutton = messageList.map(item => item).indexOf(messageList[index]); // 获取第一个时间大于30分钟的消息所在位置的下标
          const firstTime = nowadayTime; // 找到第一个数组时间戳大于30分钟的将其值设为初始值
          const showHistoryTime = Math.floor(messageList[indexbutton].time / 10) * 10 * 1000;
          Object.assign(messageList[indexbutton], {
            isShowHistoryTime: true,
          }),
          this.setData({
            firstTime: nowadayTime,
            messageHistoryTime: dayjs(showHistoryTime).format('YYYY-MM-DD HH:mm:ss'),
            showMessageHistoryTime: true,
          });
          return firstTime;
        }
      }
    },
    // 拉取更多历史消息渲染时间
    showMoreHistoryMessageTime(messageList) {
      if (messageList.length > 0) {
        const showHistoryTime = messageList[0].time * 1000;
        Object.assign(messageList[0], {
          isShowMoreHistoryTime: true,
        });
        this.data.newArr[messageList[0].ID] = dayjs(showHistoryTime).format('YYYY-MM-DD HH:mm:ss');
        this.setData({
          newArr: this.data.newArr,
        });
      }
    },
    // 消息发送失败
    sendMessageError(event) {
      this.setData({
        errorMessage: event.detail.message,
        errorMessageID: event.detail.message.ID,
      });
      const errorCode = event.detail.showErrorImageFlag;
      const { MESSAGE_ERROR_CODE, TOASTTITLE_TEXT } = constant;
      switch (errorCode) {
        case MESSAGE_ERROR_CODE.DIRTY_WORDS:
          this.showToast(TOASTTITLE_TEXT.TITLEDIRTYWORDS);
          break;
        case MESSAGE_ERROR_CODE.UPLOAD_FAIL:
          this.showToast(TOASTTITLE_TEXT.TITLEUPLOADFAIL);
          break;
        case MESSAGE_ERROR_CODE.REQUESTOR_TIME || MESSAGE_ERROR_CODE.DISCONNECT_NETWORK:
          this.showToast(TOASTTITLE_TEXT.TITLECONNECTERROR);
          break;
        case MESSAGE_ERROR_CODE.DIRTY_MEDIA:
          this.showToast(TOASTTITLE_TEXT.TITLEDIRTYMEDIA);
          break;
        default:
          break;
      }
    },
    // 消息发送失败后重新发送
    ResendMessage() {
      const { MESSAGE_ERROR_CODE, TOASTTITLE_TEXT } = constant;
      wx.showModal({
        content: '确认重发该消息？',
        success: (res) => {
          if (res.confirm) {
            wx.$TUIKit.resendMessage(this.data.errorMessage) // 传入需要重发的消息实例
              .then(() => {
                this.showToast(TOASTTITLE_TEXT.TITLERESENDSUCCESS);
                this.setData({
                  showMessageError: false,
                });
              })
              .catch((imError) => {
                switch (imError.code) {
                  case MESSAGE_ERROR_CODE.DIRTY_WORDS:
                    this.showToast(TOASTTITLE_TEXT.TITLEDIRTYWORDS);
                    break;
                  case MESSAGE_ERROR_CODE.UPLOAD_FAIL:
                    this.showToast(TOASTTITLE_TEXT.TITLEUPLOADFAIL);
                    break;
                  case MESSAGE_ERROR_CODE.REQUESTOR_TIME || MESSAGE_ERROR_CODE.DISCONNECT_NETWORK:
                    this.showToast(TOASTTITLE_TEXT.TITLECONNECTERROR);
                    break;
                  case MESSAGE_ERROR_CODE.DIRTY_MEDIA:
                    this.showToast(TOASTTITLE_TEXT.TITLEDIRTYMEDIA);
                    break;
                  default:
                    break;
                }
              });
          }
        },
      });
    },

    showToast(toastTitle) {
      if (this.data.showMessageError) {
        wx.showToast({
          title: toastTitle,
          duration: 800,
          icon: 'none',
        });
      } else {
        this.setData({
          showMessageError: true,
        });
        wx.showToast({
          title: toastTitle,
          duration: 800,
          icon: 'none',
        });
      }
    },
    // 点击头像跳转到个人信息
    getMemberProfile(e) {
      const { conversationType_text } = constant;
      if (e.currentTarget.dataset.value.conversationType === conversationType_text.typeGroup) {
        wx.$TUIKit.getGroupMemberProfile({
          groupID: e.currentTarget.dataset.value.to,
          userIDList: [e.currentTarget.dataset.value.from],
        }).then((imResponse) => {
          this.setData({
            personalProfile: imResponse.data.memberList[0],
          });
          const url =  `/TUI-CustomerService/pages/TUI-Group/memberprofile-group/memberprofile?personalProfile=${JSON.stringify(this.data.personalProfile)}`;
          wx.navigateTo({
            url,
          });
        });
      }
      if (e.currentTarget.dataset.value.conversationType === conversationType_text.typeC2C) {
        this.data.personalProfile = { avatar: e.currentTarget.dataset.value.avatar,
          nick: e.currentTarget.dataset.value.nick, userID: e.currentTarget.dataset.value.from,
          type: e.currentTarget.dataset.value.conversationType };
        this.setData({
          personalProfile: this.data.personalProfile,
        });
        const url =  `/TUI-CustomerService/pages/TUI-Group/memberprofile-group/memberprofile?personalProfile=${JSON.stringify(this.data.personalProfile)}`;
        wx.navigateTo({
          url,
        });
      }
    },
    // 点击购买链接跳转
    handleJumpLink(e) {
      const { businessID_text }  = constant;
      const dataLink = JSON.parse(e.currentTarget.dataset.value.payload.data);
      if (dataLink.businessID === businessID_text.typeOrder || dataLink.businessID === businessID_text.typeLink) {
        const url = `/pages/TUI-User-Center/webview/webview?url=${dataLink.link}&wechatMobile`;
        wx.navigateTo({
          url: encodeURI(url),
        });
      }
    },
  },

});
