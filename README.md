# bmqb-mns
[![Build Status](https://travis-ci.org/bmqb/bmqb-mns.svg?branch=master)](https://travis-ci.org/bmqb/bmqb-mns)
[![npm version](https://badge.fury.io/js/bmqb-mns.svg)](https://badge.fury.io/js/bmqb-mns)
[![codecov](https://codecov.io/gh/bmqb/bmqb-mns/branch/master/graph/badge.svg)](https://codecov.io/gh/bmqb/bmqb-mns)

基于mns的贝米钱包消息队列库

## Installation
```SHELL
npm install bmqb-mns --save
```
## Roles
* consumer: `MQConsumer(adapter, config)`
* producer: `MQProducer(adapter, config)`
* msg: `MQMSG({adapter, content, delay, priority})`

## Quick start
* 创建producer
```JS
const adapter = 'mns';
const mnsConfig = {
    accountId: 'your-account-id',
    accessKey: 'your-access-key',
    secretKey: 'your-secret-key',
};
const producer = new MQProducer(adapter, mnsConfig);

// 获取一个queue producer
const queueProducer = producer.getQueueProducer('queueName');

// 生成一个MQMsg对象
const msg = new MQMsg({
	adapter: 'mns', // 必填
	content: {foo: 'bar'}, // 必填
	delay: 10, // 延迟十秒
	priority: 'high', // 优先级, 默认为 'normal'
});

// 接收内容, pushMsg方法将返回一个Promise对象
queueProducer.pushMsg(msg).then(message => {
	// message 是一个MQMsg对象
}).catch(err => {
	// ...
});
```

* 创建consumer：
```JS
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
// 执行回调的过程是异步操作，所以可能同时存在多个任务同时消费的情况
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
        next(); // 结束循环
    } catch (err) {
        // ...
    }
}, 1); // 当消息为空时，下次请求的等待时间
```
