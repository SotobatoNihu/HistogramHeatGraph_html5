// ==UserScript==
// @name           HistogramHeatGraph_html5.user.js
// @namespace      sotoba
// @version        1.1.1.20171204
// @description    ニコニコ動画のコメントをグラフで表示(html5版)※コメントをリロードすることでグラフを再描画します
// @match          http://www.nicovideo.jp/watch/*
// @include        http://www.nicovideo.jp/watch/*
// @require        https://code.jquery.com/jquery-3.2.1.min.js
// @grant          none
// ==/UserScript==

(function () {
    'use strict';
    // default settings
    var NicoHeatGraph = function(){
        this.MINIMUMBARNUM=50;
        this.DEFAULTINTERBAL=10;
        this.MAXCOMMENTNUM=30;
        this.GRAPHHEIGHT = 30;
        this.GRAPHDEFWIDTH=856;
        this.BUTTONSIZE=15;
        this.barIndexNum=0;
        this.$canvas=null;

        this.$commentgraph=$('<div>').attr('id', 'comment-graph');
        this.$commentlist=$('<div>').attr('id', 'comment-list');

    };
    //draw background of graph
    NicoHeatGraph.prototype.drawCoordinate = function(){
        const $commentgraph = this.$commentgraph;
        const $commentlist = this.$commentlist;
        this.$canvas=$("#CommentRenderer").children('canvas').eq(0);
        $('.PlayerContainer').eq(0).append($commentgraph);
        $('.MainContainer').eq(0).append($commentlist);
        const styleString = `
#comment-graph :hover{
-webkit-filter: hue-rotate(180deg);
filter: hue-rotate(180deg);
}
#comment-list:empty {
display: none;
}
`;
        const style = document.createElement('style');
        style.appendChild(document.createTextNode(styleString));
        document.body.appendChild(style);
        var playerWidth =parseFloat(this.$canvas.css("width"))|this.GRAPHDEFWIDTH;
        $commentgraph.height(this.GRAPHHEIGHT);
        $commentgraph.width( playerWidth );
        $commentgraph.css({
            background:'repeating-linear-gradient(to top, #000, #111 5px)',
            border: '1px solid #000',
            borderTo: 0,
            float: 'left',
            fontSize: 0,
            whiteSpace: 'nowrap',
        });
        $commentlist.css({
            background: '#000',
            color: '#fff',
            fontSize: '12px',
            lineHeight: 1.25,
            padding: '4px 4px 0',
            pointerEvents:' none',
            position: 'absolute',
            zIndex: 9999,
        });
    };
    function getCommentData() {
        var ApiJsonData=JSON.parse(document.getElementById('js-initial-watch-data').getAttribute('data-api-data'));
        var thread_id;
        var video_id;
        var user_id;
        if(ApiJsonData.video.dmcInfo !== null){
            thread_id=ApiJsonData.video.dmcInfo.thread.thread_id;
            video_id=ApiJsonData.video.dmcInfo.video.video_id;
            user_id=ApiJsonData.video.dmcInfo.user.user_id;
        }else{
            thread_id=ApiJsonData.thread.ids.default;
            video_id=ApiJsonData.video.id;
            user_id=ApiJsonData.viewer.id;
        }

        if(video_id.startsWith('sm')||video_id.startsWith('nm')){
            return  $.ajax({
                url:'http://nmsg.nicovideo.jp/api/thread?thread='+thread_id+'&version=20061206&res_from=-1000&scores=1',
                type:'GET',
                dataType:'xml'
            });
        }else{
            return $.ajax({
                url:'http://flapi.nicovideo.jp/api/getthreadkey?thread='+thread_id,
                type:'GET',
            }).then(function(response){
                return  $.ajax({
                    url:'http://nmsg.nicovideo.jp/api/thread?thread='+thread_id+'&version=20061206&res_from=-1000&scores=1&user='+user_id+'&'+response,
                    type:'GET',
                    dataType:'xml'
                });
            });
        }
    }
    //draw bars  make comment list
    NicoHeatGraph.prototype.drowgraph = function(commentData,$canvas){
        const $commentgraph = this.$commentgraph;
        const $commentlist = this.$commentlist;
        var ApiJsonData=JSON.parse(document.getElementById('js-initial-watch-data').getAttribute('data-api-data'));
        var playerWidth =parseFloat($canvas.css("width"));
        var videoTotalTime = ApiJsonData.video.dmcInfo !== null ?  ApiJsonData.video.dmcInfo.video.length_seconds : ApiJsonData.video.duration;
        var barTimeInterval;

        //TODO 非常に長い（２，３時間以上）動画の処理
        //長い動画
        if(videoTotalTime > this.MINIMUMBARNUM*this.DEFAULTINTERBAL){
            barTimeInterval=this.DEFAULTINTERBAL;
            this.barIndexNum=Math.ceil(videoTotalTime / barTimeInterval);
            //普通の動画
        }else if(videoTotalTime>this.MINIMUMBARNUM){
            this.barIndexNum=this.MINIMUMBARNUM;
            barTimeInterval=videoTotalTime/this.MINIMUMBARNUM;
        }else{
            //MINIMUMBARNUM秒以下の短い動画
            this.barIndexNum=Math.floor(videoTotalTime);
            barTimeInterval=1;
        }

        $commentgraph.width( playerWidth );
        const barColors = [
            '003165',  '00458f',  '0058b5','005fc4', '006adb',
            '0072ec', '007cff', '55a7ff','3d9bff'
        ];
        var listCounts = (new Array(this.barIndexNum+1)).fill(0);
        var listMessages = (new Array(this.barIndexNum+1)).fill("");
        var listTimes = (new Array(this.barIndexNum+1)).fill("");
        var lastBarTimeIntervalGap = Math.floor(videoTotalTime- (this.barIndexNum * barTimeInterval));
        var barWidth = playerWidth / this.barIndexNum;
        var barTimePoint = 0;

        const MAXCOMMENTNUM=this.MAXCOMMENTNUM;

        $(commentData).find('chat').each(function(index){
            let vpos = $(this).attr('vpos')/100;
            //動画長を超えた時間のpostがある
            if (videoTotalTime<=vpos){
                vpos=videoTotalTime;
            }
            let section=Math.floor(vpos/barTimeInterval);
            listCounts[section]++;
            if(listCounts[section]<= MAXCOMMENTNUM){
                let comment=$(this).text().replace(/"|<|&lt;/g, ' ').replace(/\n/g, '<br>');
                listMessages[section]+=comment+'<br>';
            }
        });

        let starttime=0;
        let nexttime=0;
        for (var i = 0; i < this.barIndexNum; i++) {
            starttime=nexttime;
            nexttime+=barTimeInterval;
            if(i==this.barIndexNum-1){
                nexttime+=lastBarTimeIntervalGap;
            }
            let startmin=Math.floor(starttime/60);
            let startsec=Math.floor(starttime-startmin*60);
            let endmin=Math.floor(nexttime/60);
            let endsec=Math.ceil(nexttime-endmin*60);
            if(59 < endsec){
                endmin+=1;
                endsec-=60;
            }
            listTimes[i] += `${("0"+startmin).slice(-2)}:${("0"+startsec).slice(-2)}-${("0"+endmin).slice(-2)}:${("0"+endsec).slice(-2)}`;
        }

        // TODO なぜかthis.barIndexNum以上の配列ができる
        listCounts=listCounts.slice(0, this.barIndexNum);
        var listCountMax = Math.max.apply(null,listCounts);
        const barColorRatio = (barColors.length - 1) / listCountMax;

        $commentgraph.empty();
        $commentgraph.height(this.GRAPHHEIGHT);
        var barColor;
        var barBackground;
        for (i = 0; i < this.barIndexNum; i++) {
            barColor = barColors[Math.floor(listCounts[i] * barColorRatio)];
            barBackground = `linear-gradient(to top, #${barColor}, #${barColor} ` +
                `${listCounts[i]}px, transparent ${listCounts[i]}px, transparent)`;
            var barText = listCounts[i] ?
                `${listMessages[i]}<br><br>${listTimes[i]} コメ ${listCounts[i]}` : '';
            $('<div>')
                .css('background-image', barBackground)
                .css('float','left')
                .data('text', barText)
                .height(this.GRAPHHEIGHT)
                .width(barWidth)
                .addClass("commentbar")
                .appendTo($commentgraph);
        }
    };
    // set mouse functions
    NicoHeatGraph.prototype.addMousefunc = function($canvas){
        let $commentgraph = this.$commentgraph;
        let $commentlist = this.$commentlist;
        function mouseOverFunc() {
            $commentlist.css({
                'left': $(this).offset().left,
                'top': $commentgraph.offset().top - $commentlist.height() - 10
            })
                .html($(this).data('text'));
        }
        function mouseOutFunc() {
            $commentlist.empty();
        }

        $commentgraph.children().on({
            'mouseenter': function(val) {
                $commentlist.css({
                    'left': $(this).offset().left,
                    'top': $commentgraph.offset().top - $commentlist.height() - 10
                })
                    .html($(this).data('text'));
            },
            'mousemove': function(val) {
                $commentlist.offset({
                    'left': $(this).offset().left,
                    'top': $commentgraph.offset().top - $commentlist.height() - 10
                });
            },
            'mouseleave': function() {
                $commentlist.empty();
            }
        });

        /* 1 Dom Style Watcher本体 監視する側*/
        var domStyleWatcher = {
            Start: function(tgt, styleobj){
                function eventHappen(data1, data2){
                    var throwval = tgt.css(styleobj);
                    tgt.trigger('domStyleChange', [throwval]);
                }
                var tge = tgt[0];
                var filter = ['style'];
                var options = {
                    attributes: true,
                    attributeFilter: filter
                };
                var mutOb = new MutationObserver(eventHappen);
                mutOb.observe(tge, options);
                return mutOb;
            },
            Stop: function(mo){
                mo.disconnect();
            }
        };
        function catchEvent(event, value){
            var playerWidth=parseFloat(value);
            var barIndexNum=$('.commentbar').length;
            $commentgraph.width(playerWidth);
            $('.commentbar').width(playerWidth /barIndexNum);
        }
        var target = $canvas;
        var styleobj = 'width';
        target.on('domStyleChange', catchEvent);//イベントを登録
        var dsw = domStyleWatcher.Start(target, styleobj);//監視開始
        //domStyleWatcher.Stop(dsw);//監視終了
    };

    NicoHeatGraph.prototype.load = function(){
        let self=this;
        getCommentData().done(function(data, textStatus, jqXHR){
            this.canvas=$("#CommentRenderer").children('canvas').eq(0);
            self.drowgraph(data,this.canvas);
            self.addMousefunc(this.canvas);
        }).fail(function(jqXHR, textStatus, errorThrown){
            //TODO
            console.log("failed");
        });
    };
    NicoHeatGraph.prototype.reload = function(){
        this.load();
    };

    // Main
    var heatgraph = new NicoHeatGraph();
    heatgraph.drawCoordinate();
    heatgraph.load();
    //リロード
    let $reloadbutton=$('.ActionButton.ReloadButton').eq(0);
    $reloadbutton.click(function(e) {
        heatgraph.reload();
    });
    let $startbutton=$('.VideoStartButtonContainer').eq(0);
    $startbutton.click(function(e) {
        heatgraph.reload();
    });

})();