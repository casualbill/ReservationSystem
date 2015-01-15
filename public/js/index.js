$(function () {
	var content = $('#content');
	var status = $('#status');
	var textField = $('#textField');
	var changeNameBtn = $('#changeNameBtn');
	var sendMsgBtn = $('#sendMsgBtn');
	var interval;
	var reserveTimeArr = [];

	if (document.documentMode === 7) {
		alert ('您的浏览器版本过低或文档模式设置错误，请尝试按F12并将文档模式调整至最高版本！');
	}

	generateTable();

	socket = io.connect(window.location.origin);

	socket.on('open', function (data) {
		$('#disconnect').hide();
		$('#container').show();
		$('[type="text"]').val('');
		$('#content').html('');
		$('input').attr('disabled', false);
		$('tbody').find('span').html('');
		clearInterval(interval);
		reserveTimeArr = [];

		if (data.endTime) {
			resetTimer(data.endTime, data.serverTime, data.reserveData);
		}

		status.text(data.name);
		if (data.reserveData) {
			var inputArr = $('tbody').find('input');
			for (var i = 0; i < data.reserveData.length; i++) {
				inputArr.eq(i * 2).val(data.reserveData[i].applicant);
				inputArr.eq(i * 2 + 1).val(data.reserveData[i].strategy);
				$('tbody').find('select').eq(i).val(data.reserveData[i].status);
				if (data.reserveData[i].status == '3') {
					inputArr.eq(i * 2).attr('disabled', true);
					inputArr.eq(i * 2 + 1).attr('disabled', true);
				}
			}
		}
		if (data.historyData) {
			for (var i = 0; i < data.historyData.length; i++) {
				switch (data.historyData[i].type) {
					case 'message': printChatMsg(data.historyData[i]); break;
					case 'reserveText': printReserveTextMsg(data.historyData[i]); break;
					case 'reserveStatus': printReserveStatusMsg(data.historyData[i]); break;
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
	socket.on('system', function (data) {
		// printSystemMsg(data);
		// console.log(data)
	});
	socket.on('message', function (data) {
		printChatMsg(data);
	});
	socket.on('reserveText', function (data) {
		updateReserveText(data);
	});
	socket.on('reserveStatus', function (data) {
		updateReserveStatus(data);
	});
	socket.on('timeReset', function (data) {
		resetTimer(data.endTime, data.serverTime, data.reserveData);
	});

	textField.on('keydown', function (e) {
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
				sendReserveText(parseInt(self.parent().parent().attr('index')), self.parent().index() - 1, self.val());
			}
		})
	});

	$('tbody').find('select').on('change', function () {
		sendReserveStatus(parseInt($(this).parent().parent().attr('index')), $(this).val());
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

	function sendReserveStatus(index, value) {	
		socket.send({type: 'reserveStatus', index: index, value: value});
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

	function printReserveTextMsg(data) {
		var p = '<p>[' + data.time + ']<span style="color:' + data.color + ';"> ' + data.author + '</span> 更改预定信息：' + data.text + '（对方排位：' + data.opponentIndex + '）</p>';
		content.prepend(p);
	}

	function printReserveStatusMsg(data) {	
		var statusText;
		switch (data.value) {
			case '0': statusText = '未进攻'; break;
			case '1': statusText = '一星'; break;
			case '2': statusText = '两星'; break;
			case '3': statusText = '三星'; break;
		}
		var p = '<p>[' + data.time + ']<span style="color:' + data.color + ';"> ' + data.author + '</span> 更改战况：' + statusText + '（对方排位：' + data.index + '）</p>';
		content.prepend(p);
	}

	function updateReserveText(data) {
		var timeDiff = data.endTime - getTime();
		$('tbody').find('input').eq((data.opponentIndex - 1) * 2 + data.textIndex).val(data.text);
		$('tbody').find('span').eq(data.opponentIndex - 1).html(calcTimeRemaining(timeDiff));
		reserveTimeArr[data.opponentIndex - 1] = timeDiff;

		printReserveTextMsg(data);
	}

	function updateReserveStatus(data) {
		var tr = $('[index=' + data.index + ']');	
		tr.find('input').val('');
		tr.find('select').val(data.value);
		tr.find('span').html('')

		reserveTimeArr[data.index - 1] = null;

		if (data.value == '3') {
			tr.find('input').attr('disabled', true);
		} else {
			tr.find('input').attr('disabled', false);
		}

		printReserveStatusMsg(data);
	}

	function generateTable() {
		var table = $('tbody');
		var selectTemp = '<select><option value="0">未进攻</option><option value="1">一星</option><option value="2">两星</option><option value="3">三星</option></select>'
		for (var i = 0; i < 30; i++) {
			var indexStr = (i + 1).toString();
			var tr = $('<tr index="' + indexStr + '"><td>' + indexStr +'</td><td><input type="text" /></td><td><input type="text" /></td><td>' + selectTemp + '</td><td><span></span></td></tr>');
			table.append(tr);
		}
	}

	function resetTimer(endTime, serverTime, reserveData) {	
		clearInterval(interval);
		var timeDiff = endTime - serverTime;
		showTimeRemaining(timeDiff);

		for (var i = 0; i < reserveData.length; i++) {
			if (reserveData[i].endTime > 0) {
				reserveTimeArr[i] = reserveData[i].endTime - getTime();
			} else {
				reserveTimeArr[i] = null;
			}
		}
		
		interval = setInterval(function () {
			if (timeDiff > 0) {
				timeDiff -= 1000;
				showTimeRemaining(timeDiff);

				for (var i = 0; i < reserveTimeArr.length; i++) {
					if (reserveTimeArr[i]) {
						if (reserveTimeArr[i] > 0) {
							reserveTimeArr[i] -= 1000;
							$('tbody').find('span').eq(i).html(calcTimeRemaining(reserveTimeArr[i]));
						} else {
							reserveTimeArr[i] = null;
							$('tbody').find('span').eq(i).html('');
							$('tbody').find('span').eq(i).closest('tr').find('input').val('');
						}
					}
				}
			} else {
				clearInterval(interval);
			}
		}, 1000);
	}

	function showTimeRemaining(timeDiff) {
		if (timeDiff > 0) {
			$('h2').html('距离部落战结束还有' + calcTimeRemaining(timeDiff));
		} else {
			$('h2').html('部落战已结束');
			$('tbody').find('input').attr('disabled', true);
			$('select').attr('disabled', true);
		}
	}

	function calcTimeRemaining(timestamp) {
		var hour = parseInt(timestamp / 3600000);
		var min = parseInt(timestamp % 3600000 / 60000);
		var sec = parseInt(timestamp % 3600000 % 60000 / 1000);
		return hour.toString() + ':' + addZero(min) + ':' + addZero(sec);
	}

	function addZero(str) {
		if (str.toString().length == 1) {
			return '0' + str;
		}
		return str.toString();
	}

	function getTime() {
		return new Date().valueOf();
	}
});