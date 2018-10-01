// ==UserScript==
// @name           HistogramHeatGraph_html5.user.js
// @namespace      sotoba
// @version        1.1.3.20181001
// @description    ニコニコ動画のコメントをグラフで表示(html5版)※コメントをリロードすることでグラフを再描画します
// @match          http://www.nicovideo.jp/watch/*
// @include        http://www.nicovideo.jp/watch/*
// @require        https://code.jquery.com/jquery-3.2.1.min.js
// @grant          none
// ==/UserScript==

(function () {
    'use strict';

    // default settings
    class NicoHeatGraph {
        constructor() {
            this.MINIMUMBARNUM = 50;
            this.DEFAULTINTERBAL = 10;
            this.MAXCOMMENTNUM = 30;
            this.GRAPHHEIGHT = 30;
            this.GRAPHDEFWIDTH = 856;
            this.barIndexNum = 0;
            this.$canvas = null;
            this.$commentgraph = $('<div>').attr('id', 'comment-graph');
            this.$commentlist = $('<div>').attr('id', 'comment-list');
        }

        drawCoordinate() {
            const $commentgraph = this.$commentgraph;
            const $commentlist = this.$commentlist;
            this.$canvas = $("#CommentRenderer").children('canvas').eq(0);
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
            const playerWidth = parseFloat(this.$canvas.css("width")) | this.GRAPHDEFWIDTH;
            $commentgraph.height(this.GRAPHHEIGHT);
            $commentgraph.width(playerWidth);
            $commentgraph.css({
                background: 'repeating-linear-gradient(to top, #000, #111 5px)',
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
                pointerEvents: 'none',
                position: 'absolute',
                zIndex: 9999,
            });
        }


        drowgraph(commentData, $canvas) {
            const $commentgraph = this.$commentgraph;
            const $commentlist = this.$commentlist;
            const ApiJsonData = JSON.parse(document.getElementById('js-initial-watch-data').getAttribute('data-api-data'))
            const playerWidth = parseFloat($canvas.css("width"));
            const videoTotalTime = ApiJsonData.video.dmcInfo !== null ? ApiJsonData.video.dmcInfo.video.length_seconds : ApiJsonData.video.duration;
            let barTimeInterval;

            //TODO 非常に長い（２，３時間以上）動画の処理
            //長い動画
            if (videoTotalTime > this.MINIMUMBARNUM * this.DEFAULTINTERBAL) {
                barTimeInterval = this.DEFAULTINTERBAL;
                this.barIndexNum = Math.ceil(videoTotalTime / barTimeInterval);
                //普通の動画
            } else if (videoTotalTime > this.MINIMUMBARNUM) {
                this.barIndexNum = this.MINIMUMBARNUM;
                barTimeInterval = videoTotalTime / this.MINIMUMBARNUM;
            } else {
                //MINIMUMBARNUM秒以下の短い動画
                this.barIndexNum = Math.floor(videoTotalTime);
                barTimeInterval = 1;
            }

            $commentgraph.width(playerWidth);
            const barColors = [
                '003165', '00458f', '0058b5', '005fc4', '006adb',
                '0072ec', '007cff', '55a7ff', '3d9bff'
            ];
            let listCounts = (new Array(this.barIndexNum + 1)).fill(0);
            const listMessages = (new Array(this.barIndexNum + 1)).fill("");
            const listTimes = (new Array(this.barIndexNum + 1)).fill("");
            const lastBarTimeIntervalGap = Math.floor(videoTotalTime - (this.barIndexNum * barTimeInterval));
            const barWidth = playerWidth / this.barIndexNum;

            const MAXCOMMENTNUM = this.MAXCOMMENTNUM;

            $(commentData).find('chat').each(function (index) {
                let vpos = $(this).attr('vpos') / 100;
                //動画長を超えた時間のpostがあるため対処
                if (videoTotalTime <= vpos) {
                    vpos = videoTotalTime;
                }
                const section = Math.floor(vpos / barTimeInterval);
                listCounts[section]++;
                if (listCounts[section] <= MAXCOMMENTNUM) {
                    const comment = $(this).text().replace(/"|<|&lt;/g, ' ').replace(/\n/g, '<br>');
                    listMessages[section] += comment + '<br>';
                }
            });

            let starttime = 0;
            let nexttime = 0;
            for (let i = 0; i < this.barIndexNum; i++) {
                starttime = nexttime;
                nexttime += barTimeInterval;
                if (i == this.barIndexNum - 1) {
                    nexttime += lastBarTimeIntervalGap;
                }
                const startmin = Math.floor(starttime / 60);
                const startsec = Math.floor(starttime - startmin * 60);
                let endmin = Math.floor(nexttime / 60);
                let endsec = Math.ceil(nexttime - endmin * 60);
                if (59 < endsec) {
                    endmin += 1;
                    endsec -= 60;
                }
                listTimes[i] += `${("0" + startmin).slice(-2)}:${("0" + startsec).slice(-2)}-${("0" + endmin).slice(-2)}:${("0" + endsec).slice(-2)}`;
            }

            // TODO なぜかthis.barIndexNum以上の配列ができる
            listCounts = listCounts.slice(0, this.barIndexNum);
            const listCountMax = Math.max.apply(null, listCounts);
            const barColorRatio = (barColors.length - 1) / listCountMax;

            $commentgraph.empty();
            $commentgraph.height(this.GRAPHHEIGHT);

            for (let i = 0; i < this.barIndexNum; i++) {
                const barColor = barColors[Math.floor(listCounts[i] * barColorRatio)];
                const barBackground = `linear-gradient(to top, #${barColor}, #${barColor} ` +
                    `${listCounts[i]}px, transparent ${listCounts[i]}px, transparent)`;
                const barText = listCounts[i] ?
                    `${listMessages[i]}<br><br>${listTimes[i]} コメ ${listCounts[i]}` : '';
                $('<div>')
                    .css('background-image', barBackground)
                    .css('float', 'left')
                    .data('text', barText)
                    .height(this.GRAPHHEIGHT)
                    .width(barWidth)
                    .addClass("commentbar")
                    .appendTo($commentgraph);
            }
        }

        addMousefunc($canvas) {
            const $commentgraph = this.$commentgraph;
            const $commentlist = this.$commentlist;

            function mouseOverFunc() {
                $commentlist.css({
                    'left': $(this).offset().left,
                    'top': $commentgraph.offset().top - $commentlist.height() - 10
                }).html($(this).data('text'));
            }

            function mouseOutFunc() {
                $commentlist.empty();
            }

            $commentgraph.children().on({
                'mouseenter': function (val) {
                    $commentlist.css({
                        'left': $(this).offset().left,
                        'top': $commentgraph.offset().top - $commentlist.height() - 10
                    }).html($(this).data('text'));
                },
                'mousemove': function (val) {
                    $commentlist.offset({
                        'left': $(this).offset().left,
                        'top': $commentgraph.offset().top - $commentlist.height() - 10
                    });
                },
                'mouseleave': function () {
                    $commentlist.empty();
                }
            });

            /* 1 Dom Style Watcher本体 監視する側*/
            const domStyleWatcher = {
                Start: function (tgt, styleobj) {
                    function eventHappen(data1, data2) {
                        const throwval = tgt.css(styleobj);
                        tgt.trigger('domStyleChange', [throwval]);
                    }

                    const filter = ['style'];
                    const options = {
                        attributes: true,
                        attributeFilter: filter
                    };
                    const mutOb = new MutationObserver(eventHappen);
                    mutOb.observe(tgt[0], options);
                    return mutOb;
                },
                Stop: function (mo) {
                    mo.disconnect();
                }
            };

            function catchEvent(event, value) {
                const playerWidth = parseFloat(value);
                const barIndexNum = $('.commentbar').length;
                $commentgraph.width(playerWidth);
                $('.commentbar').width(playerWidth / barIndexNum);
            }
            const target = $canvas;
            target.on('domStyleChange', catchEvent);//イベントを登録
            domStyleWatcher.Start(target, 'width');//監視開始
            //domStyleWatcher.Stop(dsw);//監視終了
        }

        async getCommentData() {
            const ApiJsonData = await JSON.parse(document.getElementById('js-initial-watch-data').getAttribute('data-api-data'));
            let thread_id;
            let video_id;
            let user_id;
            if (ApiJsonData.video.dmcInfo !== null) {
                thread_id = ApiJsonData.video.dmcInfo.thread.thread_id;
                video_id = ApiJsonData.video.dmcInfo.video.video_id;
                user_id = ApiJsonData.video.dmcInfo.user.user_id;
            } else {
                thread_id = ApiJsonData.thread.ids.default;
                video_id = ApiJsonData.video.id;
                user_id = ApiJsonData.viewer.id;
            }
            if (video_id.startsWith('sm') || video_id.startsWith('nm')) {
                const url = `http://nmsg.nicovideo.jp/api/thread?thread=${thread_id}&version=20061206&res_from=-1000&scores=1`
                const data = await fetch(url, {mode: 'cors'})
                    .then(response => response.text())
                    .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
                return data
            } else {
                const url = `http://flapi.nicovideo.jp/api/getthreadkey?thread=${thread_id}`
                const response1 = await fetch(url, {mode: 'cors'})
                    .then(response => response.text())
                const url2 = `http://nmsg.nicovideo.jp/api/thread?thread=${thread_id}&version=20061206&res_from=-1000&scores=1&user=${user_id}&${response1}`
                const data = await fetch(url2, {mode: 'cors'})
                    .then(response => response.text())
                    .then(str => (new window.DOMParser()).parseFromString(str, "text/xml"))
                return data
            }
        }

        load() {
            const self = this;
            this.getCommentData().then(data => {
                    this.canvas = $('#CommentRenderer').children('canvas').eq(0);
                    self.drowgraph(data, this.canvas)
                    self.addMousefunc(this.canvas)
                }
            )//.catch(console.log("load failed"))
        }

        reload() {
            this.load()
        }
    }

    // Main
    const heatgraph = new NicoHeatGraph();
    heatgraph.drawCoordinate();
    heatgraph.load();

    window.onload = () =>{

        //reload when start button pushed
        const startButtons = document.getElementsByClassName('VideoStartButtonContainer')
        for (let startbutton of startButtons ) {
            startbutton.addEventListener("click", ()=>{
                console.log("comment reload.")
                heatgraph.reload()
            }, false)
        }

        // reload when reload button pushed
        const reloadButtons = document.getElementsByClassName('ReloadButton')
        for (let reloadButton of reloadButtons) {
            reloadButton.addEventListener("click", ()=>{
                console.log("comment reload.")
                heatgraph.reload()
            }, false)
        }

    }
})();
