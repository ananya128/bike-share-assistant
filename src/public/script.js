// EXACT CODE FROM THE CODEPEN - Animated Stars Background
var canvas = document.getElementById("cartesian");
var y=0,para=0;
vel=2;
t=0;
var h=window.innerHeight;
var w=window.innerWidth;
ctx = canvas.getContext("2d");
canvas.width=w;
canvas.height=h;
window.onresize=function()
{
	h=window.innerHeight;
	w=window.innerWidth;
	canvas.width=w;
	canvas.height=h;
}
document.body.onkeypress=function(e)
{
	if(e.keyCode==32)
	{
		vel=0;
	}
}
var colors=['#282058','#483048','#8850A0','#080828','#283088','#9F88D8','#1EC8FF'];
var arr=[],track=[],
vehicle={
	length:80,
	front:{
		x:100+this.length,
		y:h/1.66
	},
	back:{
		x:100,
		y:h/1.66
	},
	rad:15,
	body:{
		points:[{x:-52,y:31.5},
				{x:-37,y:31.5},
				{x:-16,y:20.5},
				{x:3,y:20.5},
				{x:8,y:32.5},
				{x:21,y:36.5},
				{x:35,y:36.5},
				{x:27,y:45.5},
				{x:45,y:36.5},
				{x:51,y:23.5},
				{x:34,y:21.5},
				{x:24,y:14.5},
				{x:17,y:2.5},
				{x:16,y:-6.5},
				{x:-15,y:-6.5},
				{x:-18,y:3.5},
				{x:-22,y:10.5},
				{x:-30,y:18.5},
				{x:-52,y:31.5}
				]
	},
	position:function(){
		deg=tanAt(100+(5*vel*t));
		this.back.x=100-this.rad*Math.sin(deg);
		this.back.y=curve(100+(5*vel*t))-(this.rad*Math.cos(deg));
		//for front wheel
		for(i=100;i<100+this.length;i++)
		{
			tempDeg=tanAt(i+(5*vel*t));
			tempX=i-this.rad*Math.sin(tempDeg);
			tempY=curve(i+(5*vel*t))-(this.rad*Math.cos(tempDeg));
			if(Math.abs(len(this.back.x,this.back.y,tempX,tempY)-this.length)<=2)
			{
				this.front.x=tempX;
				this.front.y=tempY;
				break;
			}
		}
		this.back.y-=3;
		this.front.y-=3;
	},
	draw:function(){
		deg=tanAt(100+(5*vel*(t-10)));
		ctx.strokeStyle='rgba(25,96,127,1)';
		ctx.lineWidth=6;
		ctx.fillStyle='rgba(25,96,127,1)';
		ctx.beginPath();
		ctx.arc(this.back.x,this.back.y,this.rad,0,2*Math.PI);
		ctx.closePath();
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(this.front.x,this.front.y,this.rad,0,2*Math.PI);
		ctx.closePath();
		ctx.stroke();
		ctx.lineWidth=1;
		ctx.strokeStyle='rgba(0,151,167,0.5)';
		ctx.beginPath();
		ctx.arc(this.back.x,this.back.y,this.rad+3,0,2*Math.PI);
		ctx.closePath();
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(this.front.x,this.front.y,this.rad,0,2*Math.PI);
		ctx.closePath();
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(this.back.x,this.back.y,this.rad-3,0,2*Math.PI);
		ctx.closePath();
		ctx.stroke();
		ctx.beginPath();
		ctx.arc(this.front.x,this.front.y,this.rad-3,0,2*Math.PI);
		ctx.closePath();
		ctx.stroke();
		//body of the bike
		ctx.lineWidth=1;
		ctx.beginPath();
		for(i=0;i<this.body.points.length;i++)
		{
			var n=this.body.points[i];
			tempX=n.x*Math.cos(-deg)+n.y*Math.sin(-deg);
			tempY=-n.x*Math.sin(-deg)+n.y*Math.cos(-deg);
			if(i===0)
			{
				ctx.moveTo(((this.back.x+this.front.x)/2)+tempX,((this.back.y+this.front.y)/2)-tempY);
			}
			ctx.lineTo(((this.back.x+this.front.x)/2)+tempX,((this.back.y+this.front.y)/2)-tempY);
		}
		ctx.closePath();
		ctx.stroke();
		ctx.fill();
	}
};
var t=0;
var img=document.getElementById('bike');
//distance
function len(x1,y1,x2,y2)
{
	return Math.ceil(Math.sqrt(Math.pow(x1-x2,2)+Math.pow(y1-y2,2)));
}
//Create Background Particle Array
for(i=0;i<750;i++)
{
	arr.push({
		x:Math.random()*w,
		y:Math.random()*700,
		r:Math.max(Math.random()*1.5,0.5),
		c:colors[Math.floor(Math.random()*7)]
	});
}
//Create Track Array
for(i=0;i<2*w;i++)
{
	track.push({
		x:i,
		init:i,
		y:curve(i)
	});
}
function curve(x)
{
	y=(h/1.667)-(200*Math.sin((x*Math.PI)/1200)*Math.cos((x*Math.PI)/4800)*Math.cos((x*Math.PI)/900)+(Math.PI/3));
	return y;
}
function tanAt(x)
{
	var slope=-0.1309*Math.sin(0.000654498*x)*Math.sin(0.00261799*x)*Math.sin(0.523599-0.00349066*x)+0.523599*Math.cos(0.000654498*x)*Math.cos(0.00261799*x)*Math.sin(0.523599-0.00349066*x)-0.698132*Math.sin(0.00261799*x)*Math.cos(0.000654498*x)*Math.cos(0.523599-0.00349066*x);
	return Math.atan(slope);
}
//Update Array Values
count=2*w;
function update()
{
	for (var i = 0; i < arr.length; i++) {
		n=arr[i];
		n.x=n.x-(n.r*(vel/1.2));
		if(n.x<0)
			{
				n.y=Math.random()*700;
				n.x=w-n.x;
			}
	};
	t++;
	for (i=0;i<track.length;i++) {
		n=track[i];
		n.y=curve((n.x+(5*vel*t)));
		if(n.x<0)
		{
			track.shift();
			track.push({
				x:count,
				init:count,
			y:curve(count)
			});
			count++;
		}
	}
	vehicle.position();
}

//Paint it out
function draw()
{
	t++;
	ctx.clearRect(0,0,w,700);
	
	// Debug: Log bike position every 60 frames
	if (t % 60 === 0) {
		console.log('Bike position:', {
			back: { x: vehicle.back.x, y: vehicle.back.y },
			front: { x: vehicle.front.x, y: vehicle.front.y },
			canvas: { w: w, h: h }
		});
	}
	
	//Here goes the background
	for (var i = 0; i < arr.length; i++) {
		n=arr[i];
		ctx.beginPath();
		ctx.arc(n.x,n.y,n.r,0,2*Math.PI);
		ctx.closePath();
		ctx.fillStyle=n.c;
		ctx.fill();
	};
	for (var i = 0; i < track.length; i++) {
		n=track[i];
		ctx.clearRect(n.x,n.y,1,700-n.y);
		ctx.fillStyle='#151E32';
		ctx.fillRect(n.x,n.y,1,h-n.y);
		ctx.fillStyle='rgba(10,127,235,0.5)';
		ctx.fillRect(n.x,n.y,1,1);
	};
	
	vehicle.draw();
	update();
}
//Animation Loop
function init()
{
	window.requestAnimationFrame(init);
	draw();
}

// Bike Share Analytics Assistant - Main JavaScript
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing bike animation...');
    
    // Check if canvas exists before starting animation
    const canvas = document.getElementById("cartesian");
    if (canvas) {
        console.log('✅ Canvas found, starting bike animation...');
        // Initialize bike animation
        init();
    } else {
        console.error('❌ Canvas not found!');
    }
    
    const chatContainer = document.getElementById('chatContainer');
    const questionInput = document.getElementById('questionInput');
    const sendButton = document.getElementById('sendButton');

    function addMessage(content, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user' : 'bot'}`;
        
        const messageContent = document.createElement('div');
        messageContent.className = 'message-content';
        messageContent.innerHTML = content;
        
        messageDiv.appendChild(messageContent);
        chatContainer.appendChild(messageDiv);
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }

    function addBotMessage(content) {
        addMessage(content, false);
    }

    function addUserMessage(content) {
        addMessage(content, true);
    }

    function handleKeyPress(event) {
        if (event.key === 'Enter') {
            sendQuestion();
        }
    }

    function askQuestion(question) {
        questionInput.value = question;
        sendQuestion();
    }

    async function sendQuestion() {
        const question = questionInput.value.trim();
        if (!question) return;

        // Add user message
        addUserMessage(question);
        
        // Clear input and disable button
        questionInput.value = '';
        sendButton.disabled = true;
        sendButton.innerHTML = '<div class="loading"></div>';

        try {
            const response = await fetch('/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ question })
            });

            const data = await response.json();

            if (data.error) {
                addBotMessage(`
                    ❌ <strong>Error:</strong> ${data.error}
                `);
            } else {
                let botMessage = `
                    ✅ <strong>Answer:</strong><br>
                `;

                if (data.sql) {
                    botMessage += `
                        <div class="sql-display">
                            <strong>Generated SQL:</strong><br>
                            ${data.sql}
                        </div>
                    `;
                }

                if (data.result) {
                    if (Array.isArray(data.result)) {
                        botMessage += `
                            <div class="result-display">
                                <strong>Results (${data.result.length} rows):</strong><br>
                                ${JSON.stringify(data.result, null, 2)}
                            </div>
                        `;
                    } else {
                        botMessage += `
                            <div class="result-display">
                                <strong>Result:</strong><br>
                                ${JSON.stringify(data.result, null, 2)}
                            </div>
                        `;
                    }
                }

                addBotMessage(botMessage);
            }
        } catch (error) {
            addBotMessage(`
                ❌ <strong>Network Error:</strong> ${error.message}
            `);
        } finally {
            // Re-enable button
            sendButton.disabled = false;
            sendButton.innerHTML = 'Send';
        }
    }

    // Add event listeners
    questionInput.addEventListener('keypress', handleKeyPress);
    sendButton.addEventListener('click', sendQuestion);

    // Handle example question clicks using event delegation
    document.addEventListener('click', function(event) {
        if (event.target.closest('.example-question')) {
            const question = event.target.closest('.example-question').getAttribute('data-question');
            if (question) {
                askQuestion(question);
            }
        }
    });

    // Focus input on page load
    questionInput.focus();
}); 