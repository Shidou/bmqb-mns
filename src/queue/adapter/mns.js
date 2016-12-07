import { Account, MQ } from 'ali-mns';
import jsonpack from 'jsonpack';
import MQMsg from '../../mq_msg';

export default class MNSAdapter {
  constructor({
    accountId,
    accessKey,
    secretKey,
    queueName,
    region = 'hangzhou',
  }) {
    if (!accessKey || !secretKey || !accountId) {
      throw new Error('invalid arguments');
    }
    if (!queueName) {
      throw new Error('invalid queueName');
    }

    this.config = {
      accountId,
      accessKey,
      secretKey,
      queueName,
      region,
    };
  }

  getAccount() {
    if (this.account) {
      return this.account;
    }
    this.account = new Account(this.config.accountId,
      this.config.accessKey, this.config.secretKey);
    return this.account;
  }

  getQueueHandler() {
    if (this.queueHandler) {
      return this.queueHandler;
    }
    this.queueHandler = new MQ(this.config.queueName, this.getAccount(), this.config.region);
    return this.queueHandler;
  }

  /**
   * @params msg {MQMsg} 支持字符串、json格式
   * @params delay {Integer} 延迟时间（不得大于7天，单位s）
   * @params priority {String} 优先级 0-16，默认为8
   */
  pushMsg(msg) {
    return Promise.resolve().then(() => {
      if (!(msg instanceof MQMsg)) {
        throw new Error('msg must be a MQMsg Object!');
      }
      return this.getQueueHandler().sendP(jsonpack.pack(msg.getMsg()),
          msg.getPriority(), msg.getDelay())
        .then(message => {
          msg.setId(message.Message.MessageId);
          return msg;
        });
    });
  }

  /**
   * 每次获取消息后会setTimeout异步调用注册的回调函数
   * 所以：一个消息到来后，回调还没被执行完就会紧接着消费下调消息
   */
  popMsg(callback) {
    return this.getQueueHandler().notifyRecv((err, mnsMsg) => {
      if (err) {
        callback(err);
      }
      if (mnsMsg && 'Message' in mnsMsg) {
        try {
          callback(null, this.generateMQMsg(mnsMsg));
        } catch (error) {
          callback(error);
        }
      }
    }, 1); // 没有消息时每秒轮询一次
  }

  /**
   * 串行取数据
   * callback {Function} 回调函数
   * waitSeconds {number} 等待时间
   */
  blpopMsg(callback, waitSeconds = 0) {
    const done = () => {
      this.finished = true;
    };
    if (this.finished) {
      return true;
    }
    return this.getQueueHandler()
      .recvP(waitSeconds)
      .then(mnsMsg => {
        if (mnsMsg && mnsMsg.hasOwnProperty('Message')) {
          return callback(this.generateMQMsg(mnsMsg), done);
        }
        throw new Error('Invalid mns msg object');
      })
      .then(() => {
        this.blpopMsg(callback, waitSeconds);
      })
      .catch(err => {
        if (err && err.Error && err.Error.Code === 'MessageNotExist') {
          return this.blpopMsg(callback, waitSeconds);
        }
        throw err;
      });
  }

  generateMQMsg(mnsMsg) {
    let msgMeta = mnsMsg.Message.MessageBody;
    msgMeta = jsonpack.unpack(msgMeta);
    const mqMsg = new MQMsg(msgMeta);
    mqMsg.setId(mnsMsg.Message.MessageId);
    mqMsg.setRawMsg(mnsMsg.Message);
    mqMsg.setEnqueueTime(mnsMsg.Message.EnqueueTime);
    mqMsg.setNextVisibleTime(mnsMsg.Message.NextVisibleTime);
    return mqMsg;
  }

  /**
   * @params msg {MQMsg}
   */
  deleteMsg(msg) {
    return Promise.resolve().then(() => {
      if (!msg || !(msg instanceof MQMsg)) {
        throw new Error('msg must be a MQMsg Object!');
      }
      const rawMsg = msg.getRawMsg();
      if (!rawMsg.ReceiptHandle) {
        throw new Error('The msg object have no attribute about ReceiptHandle');
      }
      return this.getQueueHandler().deleteP(rawMsg.ReceiptHandle);
    });
  }

  /**
   * 设置消息可见性
   * @param {MQMsg} msg - 消息
   * @param {number} seconds - 消息可见秒数
   */
  setMsgVisibility(msg, seconds = 1) {
    return Promise.resolve().then(() => {
      if (!msg || !(msg instanceof MQMsg)) {
        throw new Error('msg must be a MQMsg Object!');
      }
      if (!(seconds >= 1 && seconds <= 43200)) {
        throw new Error('msg visibility seconds must between 1 and 43200!');
      }
      const rawMsg = msg.getRawMsg();
      if (!rawMsg.ReceiptHandle) {
        throw new Error('The msg object have no attribute about ReceiptHandle');
      }
      return this.getQueueHandler().reserveP(rawMsg.ReceiptHandle, seconds);
    });
  }
}
