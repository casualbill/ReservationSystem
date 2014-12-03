$(function () {
	var content = $('#content');
	var status = $('#status');
	var textField = $('#textField');
	var changeNameBtn = $('#changeNameBtn');
	var sendMsgBtn = $('#sendMsgBtn');

	socket = io.connect(window.location.origin);
	socket.on('open', function(data) {
		status.text(data.name);
	});
	socket.on('system', function(data) {
		var p = '';
		if (data.type === 'welcome') {
			p = '<p style="background:'+data.color+'">['+ data.time + '] 系统消息 : ' + data.text + ' 已连接</p>';
		}
		if (data.type == 'disconnect') {
			p = '<p style="background:'+data.color+'">['+ data.time + '] 系统消息 : ' + data.text + ' 已断开</p>';
		}
		if (data.type == 'changeName') {
			p = '<p style="background:'+data.color+'">['+ data.time + '] 系统消息 : ' + data.oldName + ' 已更名为 ' + data.newName + '</p>';
		}
		content.prepend(p);
	});
	socket.on('message', function(data) {
		var p = '<p>[' + data.time + ']<span style="color:' + data.color + ';"> ' + data.author + '</span> : ' + data.text + '</p>';
		content.prepend(p);
	});


	textField.on('keydown', function(e) {
		if (e.keyCode === 13) {
			sendMsg();
		}
	});
	sendMsgBtn.on('click', function () {
		sendMsg();
	});
	changeNameBtn.on('click', function () {
		changeName();
	});

	function sendMsg() {
		var text = textField.val();
		if (text) {
			socket.send({type: 'msg', msg: text});
			textField.val('');
		}
	}

	function changeName() {
		var newName = prompt('请输入您的新名字');
		if (newName) {
			socket.send({type: 'name', msg: newName});
			status.text(newName);
		}
	}

});