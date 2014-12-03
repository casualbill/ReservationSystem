var express = require('express')
  , path = require('path')
  , app = express()
  , server = require('http').createServer(app)
  , io = require('socket.io').listen(server);

var userAmount = 0;

io.set('log level', 1); 

io.on('connection', function (socket) {
  // console.log(socket.handshake);

  userAmount++;
  var client = {
    socket: socket,
    name: '匿名' + userAmount,
    color: getColor()
  }
  socket.emit('open', { name: client.name});

  var obj = { time: getTime(), color: client.color};
  obj['text'] = client.name;
  obj['author'] = 'System';
  obj['type'] = 'welcome';
  console.log(client.name + ' Connect');

  socket.emit('system', obj);
  socket.broadcast.emit('system', obj);


  socket.on('message', function(data) {
    var obj = { time: getTime(), color: client.color};
    if (data.type == 'msg') {    
      obj['text'] = data.msg;
      obj['author'] = client.name;
      obj['type'] = 'message';
      console.log(client.name + ' say: ' + data.msg);

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

      socket.emit('system', obj);
      socket.broadcast.emit('system', obj);
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

    socket.broadcast.emit('system', obj);
    console.log(client.name + ' Disconnect');
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