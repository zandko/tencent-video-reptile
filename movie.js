const puppeteer = require('puppeteer');
const chalk = require('chalk');
const fs = require('fs');
const mongo = require('./lib/mongo');

// 延迟执行
const sleep = time => new Promise(resolve => {
    setTimeout(resolve, time);
});

// console.log 简写
const log = console.log;
// 要爬取的网页数量
const TOTAL_PAGE = 150;

// 爬取的链接
// const url = `https://v.qq.com/x/list/movie?itype=-1&offset=0`;
const url = `https://v.qq.com/channel/movie?listpage=1&channel=movie&itype=100062`;

// 格式化进度输出
function formatProgress(current) {
    let percent = (current / TOTAL_PAGE) * 100;
    let done = ~~(current / TOTAL_PAGE * 40);
    let left = 40 - done;
    let str = `当前进度：[${''.padStart(done, '=')}${''.padStart(left, '-')}]  ${percent}%`;
    return str;
}

(async () => {
    // 启动浏览器环境
    const browser = await puppeteer.launch({
        // headless: false,
        // slowMo: 250
    });
    log(chalk.green('服务正常启动'))

    try {
        const page = await browser.newPage(); // 打开一个新的页面
        // 监听内部的console消息
        page.on('console', message => {
            if (typeof message == 'object') {
                console.dir(message);
            } else {
                log(chalk.blue(message))
            }
        });

        // 打开要爬取的链接
        await page.goto(url, {
            waitUntil: 'networkidle2' // 网络空闲说明已加载完毕
        });

        log(chalk.yellow('页面初次加载完毕'));
	await sleep(3000);
        for (let i = 1; i <= TOTAL_PAGE; i++) {
            const submit = await page.$('.page_next'); // 获取下一页按钮
            if (!submit) {
                chalk.red('数据获取完毕');
                return;
            }
            await submit.click(); // 模拟点击跳转下一页
	    await sleep(3000);
            await page.waitFor(2500); // 等待页面加载完毕
            console.clear();
            // 打印当前的爬取进度
            log(chalk.yellow(formatProgress(i)));
            log(chalk.yellow('页面数据加载完毕'));

            await handleData(); // 执行方法
            await sleep(3000);
            await page.waitFor(2500); // 一个页面爬取完毕以后稍微歇歇
        }

        await browser.close();
        log(chalk.green('服务正常结束'));

        // 获取浏览器内部内容
        async function handleData() {
            const result = await page.evaluate(() => {
                var $ = window.$; // // 拿到页面上的JQuery
                var itemList = $('.list_item'); // 拿到所有的item
                var links = []; // 存储爬取的数据
                // 循环写进数组
                itemList.each((index, item) => {
                    let i = $(item);
                    let vid = i.find('.figure').data('float'); // id
                    let link = i.find('.figure').attr('href'); // 链接地址
                    let star = i.find('.figure_desc').attr('title'); // 主演
                    let title = i.find('.figure_pic').attr('alt'); // 电影名称
                    let poster = i.find('.figure_pic').attr('src'); // 封面图片
                    let count = i.find('.figure_count').text(); // 播放量
                    // 存进之前定义好的数组中
                    links.push({
                        vid,
                        title,
                        count,
                        star,
                        poster,
                        link
                    });
                });
                return links; // 返回数据
            });

            // 写入json文件中
            fs.writeFile('./movie.json', JSON.stringify(result, null, '\t', {
                'flag': 'a'
            }), function (err) {
                if (err) {
                    throw err;
                }
            });
            log(chalk.yellow('写入数据完毕'));
        }
    } catch (error) {
        console.log(error)
        log(chalk.red('服务意外终止'))
        await browser.close()
    } finally {
        process.exit(0);
    }
})();
