import { MQConsumer } from 'bmqb-mns';

const adapter = 'mns';
const mnsConfig = {
    accountId: 'your-account-id',
    accessKey: 'your-access-key',
    secretKey: 'your-secret-key',
};
const consumer = new MQConsumer(adapter, mnsConfig);

// 获取一个queue consumer
const queueConsumer = consumer.getQueueConsumer('queueName');

// 接收内容, 注册一个循环任务
queueConsumer.popMsg((err, message) => {
  // message 将是一个MQMsg对象
  // ...

    // 设置消息下次可见时间
    queueConsumer.setMsgVisibility(message, 10);

  // 确认这个消息，使得消息不会再次可见
  queueConsumer.deleteMsg(message);
});


// 串行接收消息，当前消息回调函数执行完，才会继续消费剩余的消息
queueConsumer.blpopMsg((err, message, next) => {
    // message 将是一个MQMsg对象
    // ...
    if (err) {
        console.log(err);
        return;
    }
    try {
        // 设置消息下次可见时间
        queueConsumer.setMsgVisibility(message, 10);

        // 确认这个消息，使得消息不会再次可见
        queueConsumer.deleteMsg(message);
        next(); // 下一次循环
    } catch (err) {
      // ...
    }
}, 1); // 当消息为空时，下次请求的等待时间
