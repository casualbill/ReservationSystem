var express = require('express')
  , path = require('path')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

var userAmount = 0;
var historyData = [];
var reserveData = [];

for (var i = 0; i < 30; i++) {
  reserveData.push({applicant: null, strategy: null, status: 0});
}

io.set('log level', 1); 

io.on('connection', function (socket) {
  // console.log(socket.handshake);

  userAmount++;
  var client = {
    socket: socket,
    id: userAmount,
    name: '匿名' + userAmount,
    color: getColor()
  }

  socket.emit('open', { name: client.name, historyData: historyData, reserveData: reserveData});

  var obj = { time: getTime(), color: client.color};
  obj['text'] = client.name;
  obj['author'] = 'System';
  obj['type'] = 'welcome';
  console.log(client.name + ' Connect');
  
  historyData.push(obj);

  socket.emit('system', obj);
  socket.broadcast.emit('system', obj);


  socket.on('message', function(data) {
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
      obj['author'] = client.name;
      obj['opponentIndex'] = data.opponentIndex;
      obj['textIndex'] = data.textIndex;
      obj['text'] = data.msg;
      obj['type'] = 'reserveText';

      console.log(client.name + ' changed reserve info. Opponent:' + data.opponentIndex + ', Text:' + data.textIndex + ' ' + data.msg);
      historyData.push(obj);

      if (data.textIndex == 0) {
        reserveData[data.opponentIndex - 1].applicant = data.msg;
      }
      if (data.textIndex == 1) {
        reserveData[data.opponentIndex - 1].strategy = data.msg;
      }

      socket.emit('reserveText', obj);
      socket.broadcast.emit('reserveText', obj);
    }

    if (data.type == 'reserveStatus') {
      obj['author'] = client.name;
      obj['index'] = data.index;
      obj['value'] = data.value;
      obj['type'] = 'reserveStatus';

      console.log(client.name + ' changed reserve info. Opponent:' + data.index + ', Status:' + data.value);
      historyData.push(obj);

      reserveData[data.index - 1].status = data.value;
      reserveData[data.index - 1].applicant = null;
      reserveData[data.index - 1].strategy = null;

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

});


app.configure(function(){
  app.set('port', process.env.PORT || 80);
  app.set('views', __dirname + '/views');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
  app.use(express.errorHandler());
});

app.get('/', function(req, res){
  res.sendfile('views/index.html');
});

app.get('/historyData', function(req, res){
  res.writeHead(200, {"Content-Type": "application/javascript;charset=UTF-8"});
  res.end(JSON.stringify(historyData));
});

app.get('/reserveData', function(req, res){
  res.writeHead(200, {"Content-Type": "application/javascript;charset=UTF-8"});
  res.end(JSON.stringify(reserveData));
});


server.listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});

var getTime = function() {
  var date = new Date();
  return date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
}

var getColor = function(){
  var colors = ['aliceblue', 'antiquewhite', 'aqua', 'aquamarine', 'pink', 'red', 'green', 'orange', 'blue', 'blueviolet', 'brown', 'burlywood', 'cadetblue'];
  return colors[Math.round(Math.random() * 10000 % colors.length)];
}