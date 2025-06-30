"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var express_1 = require("express");
var http_1 = require("http");
var cors_1 = require("cors");
var dotenv_1 = require("dotenv");
var socket_io_1 = require("socket.io");
var db_1 = require("./config/db");
dotenv_1.default.config();
var app = (0, express_1.default)();
var server = http_1.default.createServer(app); //creating a http server from express app
//cors
var FRONTEND_URL = process.env.FRONTEND_URL;
var io = new socket_io_1.Server(server, {
    cors: {
        origin: FRONTEND_URL,
        methods: ["POST", "GET"],
        credentials: true
    }
});
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: FRONTEND_URL,
    credentials: true
}));
//routes
app.get('/', function (req, res) {
    res.send('WebRTC Signaling server is running');
});
(0, db_1.default)();
var PORT = process.env.PORT;
server.listen(PORT, function () { return console.log("server running on port: ".concat(PORT)); });
