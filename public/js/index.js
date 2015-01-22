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
		$('h2').children().eq(1).html('');
		$('h3').html('');
		clearInterval(interval);
		reserveTimeArr = [];

		status.text(data.name);

		if (data.endTime) {
			resetTimer(data.endTime, data.serverTime, data.reserveData);
		}
		if (data.bulletin) {
			$('h3').html(data.bulletin);
		}

		if (data.reserveData) {
			var totalScore = 0;
			var inputArr = $('tbody').find('input');
			for (var i = 0; i < data.reserveData.length; i++) {
				inputArr.eq(i * 2).val(data.reserveData[i].applicant);
				inputArr.eq(i * 2 + 1).val(data.reserveData[i].strategy);
				$('tbody').find('select').eq(i).val(data.reserveData[i].status);
				if (data.reserveData[i].status == '3') {
					inputArr.eq(i * 2).attr('disabled', true);
					inputArr.eq(i * 2 + 1).attr('disabled', true);
				}
				totalScore += data.reserveData[i].score;
			}

			if (totalScore > 0) {
				$('h2').children().eq(1).html('当前共' + totalScore + '星');
			}
		}
		if (data.historyData) {
			for (var i = 0; i < data.historyData.length; i++) {
				switch (data.historyData[i].type) {
					case 'message': printChatMsg(data.historyData[i]); break;
					case 'reserveText': printReserveTextMsg(data.historyData[i]); break;
					case 'reserveStatus': printReserveStatusMsg(data.historyData[i]); break;
					case 'timeReset' : printTimeResetMsg(data.historyData[i]); break;
					case 'reserveExpired': printReserveExpiredMsg(data.historyData[i]); break;
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
		printTimeResetMsg(data);
	});
	socket.on('reserveExpired', function (data) {
		printReserveExpiredMsg(data);
	});
	socket.on('syncData', function (data) {
		resetTimer(data.endTime, data.serverTime, data.reserveData);
	});
	socket.on('bulletin', function (data) {
		$('h3').html(data.bulletin);
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
		if (!newName || newName.match('匿名')) {
			newName = prompt('请输入您的新名字', oldName ? oldName : '');
		}

		if (newName && newName.trim().length > 0 && !newName.match('匿名')) {
			socket.send({type: 'name', msg: newName});
			status.text(newName);
			window.localStorage.setItem('username', newName);
		} else {
			setTimeout(changeName, 1000);
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
			p = '<p style="background:'+data.color+'">['+ timeFomatter(data.time) + '] 系统消息 : ' + data.text + ' 已连接</p>';
		}
		if (data.type == 'disconnect') {
			p = '<p style="background:'+data.color+'">['+ timeFomatter(data.time) + '] 系统消息 : ' + data.text + ' 已断开</p>';
		}
		if (data.type == 'changeName') {
			p = '<p style="background:'+data.color+'">['+ timeFomatter(data.time) + '] 系统消息 : ' + data.oldName + ' 已更名为 ' + data.newName + '</p>';
		}
		content.prepend(p);
	}

	function printChatMsg(data) {
		var p = '<p>[' + timeFomatter(data.time) + ']<span style="color:' + data.color + ';"> ' + data.author + '</span> : ' + data.text + '</p>';
		content.prepend(p);
	}

	function printReserveTextMsg(data) {
		var p = '<p>[' + timeFomatter(data.time) + ']<span style="color:' + data.color + ';"> ' + data.author + '</span> 更改预定信息：' + data.text + '（对方排位：' + data.opponentIndex + '）</p>';
		content.prepend(p);
	}

	function printReserveStatusMsg(data) {
		var statusText;
		var p;
		if (data.cancel) {
			p = '<p>[' + timeFomatter(data.time) + ']<span style="color:' + data.color + ';"> ' + data.author + '</span> 取消了对方排位：' + data.index + '的预定</p>';
		} else {
			switch (data.value) {
				case '0': statusText = '未进攻'; break;
				case '1': statusText = '一星'; break;
				case '2': statusText = '两星'; break;
				case '3': statusText = '三星'; break;
				case '4': statusText = '逗比'; break;
				case '-1': statusText = '取消预订'; break;
			}
			p = '<p>[' + timeFomatter(data.time) + ']<span style="color:' + data.color + ';"> ' + data.author + '</span> 更改战况：' + statusText + '（对方排位：' + data.index + '）</p>';
		}
		content.prepend(p);
	}

	function printTimeResetMsg(data) {
		content.prepend('<p style="background: #999">['+ timeFomatter(data.time) + '] 系统消息 : 部落战结束时间已更新至' + timeFomatter(data.endTime, true) + ' </p>');
	}

	function printReserveExpiredMsg(data) {
		content.prepend('<p style="background: #999">['+ timeFomatter(data.time) + '] 系统消息 : 对方排位' + (data.index + 1).toString() + ' 的预订已过期，预订信息重置</p>');
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
		tr.find('span').html('')

		reserveTimeArr[data.index - 1] = null;

		tr.find('select').val(data.value);
		if (data.value == '3') {
			tr.find('input').attr('disabled', true);
		} else {
			tr.find('input').attr('disabled', false);
		}

		$('h2').children().eq(1).html('当前共' + data.totalScore + '星');

		printReserveStatusMsg(data);
	}

	function generateTable() {
		var table = $('tbody');
		var selectTemp = '<select><option value="0">未进攻</option><option value="1">★</option><option value="2">★★</option><option value="3">★★★</option><option value="4">☆</option><option value="-1">取消预订</option></select>'
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
		
		updateTimer();
		interval = setInterval(updateTimer, 1000);

		function updateTimer() {
			if (timeDiff > 0) {
				timeDiff -= 1000;
				showTimeRemaining(timeDiff);

				if (timeDiff > 86400000) {
					$('tbody').find('select').attr('disabled', true);
				} else {
					$('tbody').find('select').attr('disabled', false);
				}

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
		}
	}

	function showTimeRemaining(timeDiff) {
		if (timeDiff > 0) {
			$('h2').children().eq(0).html('距离部落战结束还有' + calcTimeRemaining(timeDiff));
		} else {
			$('h2').children().eq(0).html('部落战已结束');
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

	function timeFomatter(timestamp, fullDate) {
		var date = new Date(timestamp);
		var dateStr = date.getFullYear() + '-' + (date.getMonth() + 1).toString() + '-' + date.getDate();
		var timeStr = date.getHours() + ':' + addZero(date.getMinutes()) + ':' + addZero(date.getSeconds());
		if (fullDate) {
			return dateStr + ' ' + timeStr;
		}
		return timeStr;
	}
});