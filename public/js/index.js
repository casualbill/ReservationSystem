$(function () {
	var content = $('#content');
	var status = $('#status');
	var textField = $('#textField');
	var changeNameBtn = $('#changeNameBtn');
	var sendMsgBtn = $('#sendMsgBtn');

	if (document.documentMode === 7) {
		alert ('您的浏览器版本过低或文档模式设置错误，请尝试按F12并将文档模式调整至最高版本！');
	}

	generateTable();

	socket = io.connect(window.location.origin);

	socket.on('open', function(data) {
		$('#disconnect').hide();
		$('#container').show();
		$('[type="text"]').val('');
		$('#content').html('');

		status.text(data.name);
		if (data.reserveData) {
			for (var i = 0; i < data.reserveData.length; i++) {
				$('tbody').find('input').eq(i * 2).val(data.reserveData[i].applicant);
				$('tbody').find('input').eq(i * 2 + 1).val(data.reserveData[i].strategy);
			}
		}
		if (data.historyData) {
			for (var i = 0; i < data.historyData.length; i++) {
				if (data.historyData[i].author == 'System') {
					// printSystemMsg(data.historyData[i]);
				} else {
					if (data.historyData[i].opponentIndex) {
						printReserveMsg(data.historyData[i]);
					} else {
						printChatMsg(data.historyData[i]);
					}
				}
			}
		}

		var username = window.localStorage.getItem('username');
		changeName(username, data.name);
	});
	socket.on('disconnect', function () {
		$('#container').hide();
		$('#disconnect').show();
	});
	socket.on('system', function(data) {
		// printSystemMsg(data);
		console.log(data)
	});
	socket.on('message', function(data) {
		printChatMsg(data);
	});
	socket.on('reserveText', function(data) {
		updateReserveText(data);
	});

	textField.on('keydown', function(e) {
		if (e.keyCode === 13) {
			sendChatMsg();
		}
	});
	sendMsgBtn.on('click', function () {
		sendChatMsg();
	});
	changeNameBtn.on('click', function () {
		changeName();
	});

	$('tbody').find('input').on('focus', function () {
		var self = $(this);
		var formerText = self.val()
		self.one('blur', function () {
			if (formerText != self.val()) {
				sendReserveText(self.parent().parent().attr('index'), self.parent().index() - 1, self.val());
			}
		})
	});

	function sendChatMsg() {
		var text = textField.val();
		if (text) {
			socket.send({type: 'msg', msg: text});
			textField.val('');
		}
	}

	function changeName(newName, oldName) {
		if (!newName) {
			newName = prompt('请输入您的新名字', oldName ? oldName : '');
		}

		if (newName && newName.length > 0) {
			socket.send({type: 'name', msg: newName});
			status.text(newName);
			window.localStorage.setItem('username', newName);
		}
	}

	function sendReserveText(opponentIndex, textIndex, text) {
		socket.send({type: 'reserveText', opponentIndex: opponentIndex, textIndex: textIndex, msg: text});
	}

	function printSystemMsg(data) {
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
	}

	function printChatMsg(data) {
		var p = '<p>[' + data.time + ']<span style="color:' + data.color + ';"> ' + data.author + '</span> : ' + data.text + '</p>';
		content.prepend(p);
	}

	function printReserveMsg(data) {
		var p = '<p>[' + data.time + ']<span style="color:' + data.color + ';"> ' + data.author + '</span> 更改预定信息：' + data.text + '（对方排位：' + data.opponentIndex + '）</p>';
		content.prepend(p);
	}

	function updateReserveText(data) {
		$('tbody').find('input').eq((data.opponentIndex - 1) * 2 + data.textIndex).val(data.text);
		printReserveMsg(data);
	}

	function generateTable() {
		var table = $('tbody');
		for (var i = 0; i < 30; i++) {
			var indexStr = (i + 1).toString();
			var tr = $('<tr index="' + indexStr + '"><td>' + indexStr +'</td><td><input type="text" /></td><td><input type="text" /></td></tr>');
			table.append(tr);
		}
	}

});