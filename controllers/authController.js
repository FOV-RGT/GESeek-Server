const { User } = require('../models');
const jwt = require('jsonwebtoken');
const { validationResult } = require('express-validator');
const { Op } = require('sequelize');
require('dotenv').config();

// 登录
exports.login = async (req, res) => {
    try {
        // 验证请求
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        // 查找用户
        const { credential, password } = req.body;
        const user = await User.findOne({
            where: {
                [Op.or]: [
                    { username: credential },
                    { email: credential }
                ],
                isActive: true // 确保账号处于激活状态
            }
        });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }
        // 验证密码
        const isMatch = await user.validatePassword(password);
        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: '用户名或密码错误'
            });
        }
        user.lastLogin = new Date(); // 更新最后登录时间
        await user.save(); // 保存更新
        // 生成JWT
        const token = jwt.sign(
            {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '12h' } // 12小时过期
        );
        res.json({
            success: true,
            token,
            user: {
                id: user.id,
                username: user.username,
                email: user.email,
                fullName: user.fullName,
                avatarUrl: user.avatarUrl,
                role: user.role
            }
        });
    } catch (e) {
        console.error('登录错误:', e);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试',
            error: e.message || '未知错误'
        });
    }
}

// 注册
exports.register = async (req, res) => {
    try {
        // 验证请求
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }
        const { username, email, password, fullName } = req.body;
        // 检查用户名是否已存在
        const existingUsername = await User.findOne({
            where: { username }
        });
        if (existingUsername) {
            return res.status(400).json({
                success: false,
                message: '用户名已被注册'
            });
        }
        if (email && email.trim() !== '') {
            const existingEmail = await User.findOne({
                where: { email }
            });
            if (existingEmail) {
                return res.status(400).json({
                    success: false,
                    message: '邮箱已被注册'
                });
            }
        }
        // 创建新用户
        const newUser = await User.create({
            username,
            email,
            password, // 密码会在模型中自动哈希加密
            fullName,
            role: 'user', // 默认角色为用户
            isActive: true // 默认激活状态
        });
        // 生成JWT
        const token = jwt.sign(
            {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                role: newUser.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '12h' }
        );
        res.status(201).json({
            success: true,
            token,
            user: {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email || null,
                fullName: newUser.fullName || null,
                role: newUser.role
            }
        });
    } catch (e) {
        console.error('注册错误:', e);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试',
            error: e.message || '未知错误'
        });
    }
}

// 获取用户信息
exports.getCurrentUser = async (req, res) => {
    try {
        const user = await User.findByPk(req.user.id, {
            attributes: [
                'id',
                'username',
                'email',
                'fullName',
                'avatarUrl',
                'role',
                'lastLogin',
                'isActive',
                'createdAt',
                'updatedAt'
            ]
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在'
            });
        }
        res.json({
            success: true,
            user
        });
    } catch (e) {
        console.error('获取用户信息错误:', e);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试',
            error: e.message || '未知错误'
        });
    }
}

// 获取所有用户信息
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.findAll({
            attributes: [
                'id',
                'username',
                'email',
                'fullName',
                'avatarUrl',
                'role',
                'lastLogin',
                'isActive',
                'createdAt',
                'updatedAt'
            ]
        });
        res.json({
            success: true,
            users
        })
    } catch (e) {
        console.error('获取所有用户信息错误:', e);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试',
            error: e.message || '未知错误'
        });
    }
}

// 刷新令牌
exports.refreshToken = async (req, res) => {
    try {
        const user = await User.findOne({
            where: {
                id: req.user.id,
                isActive: true // 确保账号处于激活状态
            },
            attributes: [
                'id',
                'username',
                'email',
                'role'
            ]
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: '用户不存在或已被禁用'
            });
        }
        // 生成新token
        const newToken = jwt.sign(
            {
                id: user.id,
                username: user.username,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET,
            { expiresIn: '12h' } // 12小时过期
        );
        res.json({
            success: true,
            token: newToken
        });
    } catch (e) {
        console.error('刷新令牌错误:', e);
        res.status(500).json({
            success: false,
            message: '服务器错误，请稍后再试',
            error: e.message || '未知错误'
        });
    }
}