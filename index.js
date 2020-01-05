require("dotenv").config();
require("./server");
const email = require("emailjs"),
  Telegraf = require("telegraf"),
  bot = new Telegraf(process.env.BOT_TOKEN),
  { TelegrafMongoSession } = require("telegraf-session-mongodb"),
  { MongoClient } = require("mongodb");

let session;

console.log(process.env.USERNAME);

const server = email.server.connect({
  user: process.env.USERNAME,
  password: process.env.PASSWORD,
  host: process.env.HOST,
  ssl: true
});
const server_ALT = email.server.connect({
  user: process.env.USERNAME_ALT,
  password: process.env.PASSWORD_ALT,
  host: process.env.HOST_ALT,
  ssl: true
});

bot.use((...args) => session.middleware(...args));
MongoClient.connect(process.env.MONGOURL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(client => {
  const db = client.db();
  session = new TelegrafMongoSession(db, {
    collectionName: "sessions",
    sessionName: "session"
  });
  bot.startPolling();
});

bot.start(ctx =>
  ctx.replyWithMarkdown(
    "Привет! Я помогу тебе быстро добавлять задачи и заметки во Входящие прямо из Телеграм.\n\nОтправь мне почту из настроек, её можно найти во вкладке Things Cloud. Она должна иметь такой вид:\nadd-to-things-TOKEN@things.email\n\nЕё так же можно сменить в любой момент в приложении[‌‌](https://i.imgur.com/PPlfCqa.png)"
  )
);
bot.hears(/^add-to-things-([\w]*[\w\.]*(?!\.)@things.email)/, ctx => {
  ctx.session.email = ctx.message;
  console.log(ctx.session);
  ctx.reply(
    `Отлично, я добавил почту ${ctx.session.email.text} к твоему аккаунту.\nТеперь просто отправь мне сообщение, чтобы я добавил его в твои Входящие.\nДля отправки может потребоваться пара секунд, это нормально. Не забудь, что во время синхронизации во Входящих мигает ☁️`
  );
});
bot.on("text", ctx => {
  if (!ctx.session.email) {
    ctx.reply("Добавте свою почту. Подробнее в /start");
  } else {
    server.send(
      {
        subject: ctx.message.text,
        from: process.env.USERNAME,
        to: ctx.session.email.text,
        text: ""
      },
      err => {
        if (!err) {
          ctx.reply("Добавил это в твои Входящие");
        } else {
          server_ALT.send(
            {
              subject: ctx.message.text,
              from: process.env.USERNAME_ALT,
              to: ctx.session.email.text,
              text: ""
            },
            err_2 => {
              if (!err_2) {
                ctx.reply("Добавил это в твои Входящие");
              } else {
                ctx.reply(
                  "Что-то пошло не так.. Скорее всего почта посчитала это сообщение спамом, попробуй отправить ещё раз"
                );
                console.log(err);
              }
            }
          );
        }
      }
    );
  }
});
bot.launch();
