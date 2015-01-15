var express = require('express')
  , path = require('path')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server)
  , events = require('events')
  , emitter = new events.EventEmitter();

var userAmount = 0;
var historyData = [];
var reserveData = [];
var endTime = new Date().valueOf() + 172800000;

for (var i = 0; i < 30; i++) {
  reserveData.push({applicant: null, strategy: null, status: 0, endTime: 0, reserveTime: 0});
}

setInterval(function () {
  var nowTime = new Date().valueOf();
  for (var i = 0; i < reserveData.length; i++) {
    if (reserveData[i].endTime < nowTime) {
      reserveData[i].applicant = null;
      reserveData[i].strategy = null;
      reserveData[i].endTime = 0;
      reserveData[i].reserveTime = 0;
    }
  }
}, 1000);

io.set('log level', 1);

io.on('connection', function (socket) {
  // console.log(socket.handshake);

  userAmount++;
  var client = {
    socket: socket,
    id: userAmount,
    name: '匿名' + userAmount,
    color: getColor()
  };

  socket.emit('open', {
    name: client.name,
    historyData: historyData,
    reserveData: reserveData,
    serverTime: new Date().valueOf(),
    endTime: endTime ? endTime.valueOf() : null
  });

  var obj = { time: getTime(), color: client.color};
  obj['text'] = client.name;
  obj['author'] = 'System';
  obj['type'] = 'welcome';
  console.log(client.name + ' Connect');
  
  historyData.push(obj);

  socket.emit('system', obj);
  socket.broadcast.emit('system', obj);


  socket.on('message', function (data) {
    var obj = { time: getTime(), color: client.color};
    if (data.type == 'msg') {    
      obj['text'] = data.msg;
      obj['author'] = client.name;
      obj['type'] = 'message';
      console.log(client.name + ' say: ' + data.msg);
      historyData.push(obj);

      socket.emit('message', obj);
      socket.broadcast.emit('message', obj);
    }

    if (data.type == 'name') {
      obj['oldName'] = client.name;
      obj['newName'] = data.msg;
      obj['author'] = 'System';
      obj['type'] = 'changeName';

      console.log(client.name + ' changed name: ' + data.msg);
      client.name = data.msg;
      historyData.push(obj);

      socket.emit('system', obj);
      socket.broadcast.emit('system', obj);
    }

    if (data.type == 'reserveText') {
      if (data.textIndex == 0) {
        reserveData[data.opponentIndex - 1].applicant = data.msg;
      }
      if (data.textIndex == 1) {
        reserveData[data.opponentIndex - 1].strategy = data.msg;
      }

      var reserveTime = new Date().valueOf();
      var reserveEndTime = getReserveEndTime(reserveTime);
      reserveData[data.opponentIndex - 1].reserveTime = reserveTime
      reserveData[data.opponentIndex - 1].endTime = reserveEndTime;

      obj['author'] = client.name;
      obj['opponentIndex'] = data.opponentIndex;
      obj['textIndex'] = data.textIndex;
      obj['text'] = data.msg;
      obj['endTime'] = reserveEndTime;
      obj['type'] = 'reserveText';

      console.log(client.name + ' changed reserve info. Opponent:' + data.opponentIndex + ', Text:' + data.textIndex + ' ' + data.msg);
      historyData.push(obj);

      socket.emit('reserveText', obj);
      socket.broadcast.emit('reserveText', obj);
    }

    if (data.type == 'reserveStatus') {
      obj['author'] = client.name;
      obj['index'] = data.index;
      obj['value'] = data.value;
      obj['endTime'] = 0;
      obj['type'] = 'reserveStatus';

      console.log(client.name + ' changed reserve info. Opponent:' + data.index + ', Status:' + data.value);
      historyData.push(obj);

      reserveData[data.index - 1].status = data.value;
      reserveData[data.index - 1].applicant = null;
      reserveData[data.index - 1].strategy = null;
      reserveData[data.index - 1].endTime = 0;

      socket.emit('reserveStatus', obj);
      socket.broadcast.emit('reserveStatus', obj);
    }

  });

  socket.on('disconnect', function () {  
    var obj = {
      time: getTime(),
      color: client.color,
      author: 'System',
      text: client.name,
      type: 'disconnect'
    };

    console.log(client.name + ' Disconnect');
    historyData.push(obj);
    
    socket.broadcast.emit('system', obj);
  });

  emitter.removeAllListeners();
  emitter.on('timeReset', function () {
    var obj = {
      time: getTime(),
      color: client.color,
      author: 'System',
      endTime: endTime,
      serverTime: new Date().valueOf(),
      type: 'timeReset',
      reserveData: reserveData
    };
    socket.emit('timeReset', obj);
    socket.broadcast.emit('timeReset', obj);
  });

});


app.configure(function () {
  app.set('port', process.env.PORT || 80);
  app.set('views', __dirname + '/views');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function () {
  app.use(express.errorHandler());
});

app.get('/', function (req, res) {
  res.sendfile('views/index.html');
});

app.get('/admin', function (req, res) {
  res.sendfile('views/admin.html');
});

app.post('/timecfg', function (req, res) {
  endTime = new Date(req.body.date + ' ' + req.body.time).valueOf();
  var nowTime = new Date().valueOf();
  for (var i = 0; i < reserveData.length; i++) {
    if (reserveData[i].endTime != 0) {
      reserveData[i].endTime = getReserveEndTime(reserveData[i].reserveTime);
    }
  }

  emitter.emit('timeReset');
  res.send('New time: ' + new Date(endTime).toString() + '<br />timestamp: ' + endTime);
});

app.get('/historyData', function (req, res) {
  res.writeHead(200, {"Content-Type": "application/javascript;charset=UTF-8"});
  res.end(JSON.stringify(historyData));
});

app.get('/reserveData', function (req, res) {
  res.writeHead(200, {"Content-Type": "application/javascript;charset=UTF-8"});
  res.end(JSON.stringify(reserveData));
});

server.listen(app.get('port'), function () {
  console.log("Express server listening on port " + app.get('port'));
});

var getTime = function () {
  var date = new Date();
  return date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
}

var getColor = function () {
  var colors = ['aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'pink', 'red', 'green', 'orange', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue'];
  return colors[Math.round(Math.random() * 10000 % colors.length)];
}

var getReserveEndTime = function (reserveTime) {
  var timeDiff = endTime - reserveTime;
  var reserveEndTime;
  if (timeDiff >= 86400000) { reserveEndTime = endTime - 43200000;}
  else if (timeDiff < 86400000 && timeDiff >= 7200000) { reserveEndTime = endTime - timeDiff / 2;}
  else if (timeDiff < 7200000 && timeDiff >= 3600000) { reserveEndTime = endTime - 3600000;}
  else if (timeDiff < 3600000) { reserveEndTime = endTime;}
  return reserveEndTime;
}