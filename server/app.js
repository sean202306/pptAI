const express = require('express');
const cors = require('cors');
const pptxgen = require('pptxgenjs');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// 初始化DeepSeek API客户端
const openai = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: 'sk-4b5b1f4204184f00b184e60ba2c4b701'
});

// 获取可用模板列表的API - 移到了路由处理函数外部
app.get('/api/templates', (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');
    const templatesDir = path.join(__dirname, 'templates');
    
    // 确保模板目录存在
    if (!fs.existsSync(templatesDir)) {
      fs.mkdirSync(templatesDir, { recursive: true });
    }
    
    // 读取模板目录中的所有.pptx文件
    const templateFiles = fs.readdirSync(templatesDir)
      .filter(file => file.endsWith('.pptx'))
      .map(file => ({
        id: file.replace('.pptx', ''),
        name: file.replace('.pptx', '').replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())
      }));
    
    res.json(templateFiles);
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).send('获取模板列表失败');
  }
});

app.post('/api/generate-ppt', async (req, res) => {
  try {
    const { content, templateName } = req.body;
    console.log('Received content:', content);
    console.log('Template selected:', templateName || 'default');

    if (!content) {
      throw new Error('No content provided');
    }

    // Add error handling for OpenAI initialization
    if (!openai) {
      throw new Error('OpenAI client not initialized');
    }

    console.log('Calling DeepSeek API...');
    const completion = await openai.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: "你是一个专业的PPT设计师。请根据用户提供的内容，生成一个结构化的PPT大纲和内容。返回格式应为JSON，包含slides数组，每个slide对象包含title和content字段。" 
        },
        { 
          role: "user", 
          content: `请根据以下内容生成PPT大纲和内容：\n\n${content}` 
        }
      ],
      model: "deepseek-chat",
    }).catch(error => {
      console.error('DeepSeek API Error:', error);
      throw error;
    });

    console.log('DeepSeek API response received');
    
    // 解析API返回的内容
    let pptContent;
    try {
      const responseText = completion.choices[0].message.content;
      console.log('API response text:', responseText);
      
      // 尝试提取JSON部分
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || 
                        responseText.match(/```\n([\s\S]*?)\n```/) ||
                        [null, responseText];
      
      const jsonText = jsonMatch[1] || responseText;
      console.log('Extracted JSON text:', jsonText);
      
      pptContent = JSON.parse(jsonText);
      console.log('Parsed PPT content:', pptContent);
    } catch (parseError) {
      console.error('Error parsing API response:', parseError);
      console.log('Raw response:', completion.choices[0].message.content);
      
      // 如果解析失败，创建一个简单的结构
      pptContent = {
        slides: [
          {
            title: "内容概要",
            content: content.substring(0, 200) + "..."
          },
          {
            title: "详细内容",
            content: content
          }
        ]
      };
    }
    // 根据模板名称加载不同的模板
    if (templateName) {
      try {
        const fs = require('fs');
        const path = require('path');
        const templatesDir = path.join(__dirname, 'templates');
        const templatePath = path.join(templatesDir, `${templateName}.pptx`);
        
        // 检查模板是否存在
        if (fs.existsSync(templatePath)) {
          console.log(`Loading template: ${templatePath}`);
          pres = new pptxgen();
          await pres.load(fs.readFileSync(templatePath));
          console.log('Template loaded successfully');
        } else {
          console.log(`Template not found: ${templatePath}, using default`);
          pres = new pptxgen();
        }
      } catch (templateError) {
        console.error('Error loading template:', templateError);
        pres = new pptxgen();
      }
    } else {
      pres = new pptxgen();
    }
    
    // 添加封面幻灯片
    const coverSlide = pres.addSlide();
    coverSlide.addText("AI生成的演示文稿", { 
      x: 1, 
      y: 2, 
      fontSize: 36,
      bold: true,
      color: "363636" 
    });
    coverSlide.addText("基于DeepSeek AI生成", { 
      x: 1, 
      y: 3, 
      fontSize: 20,
      color: "666666" 
    });
    
    // 根据API返回内容动态生成幻灯片
    if (pptContent && pptContent.slides) {
      pptContent.slides.forEach(slide => {
        const newSlide = pres.addSlide();
        
        // 添加标题
        newSlide.addText(slide.title, { 
          x: 0.5, 
          y: 0.5, 
          w: '90%',
          fontSize: 24,
          bold: true,
          color: "363636" 
        });
        
        // 添加内容
        newSlide.addText(slide.content, { 
          x: 0.5, 
          y: 2, 
          w: '90%',
          fontSize: 16,
          color: "666666" 
        });
      });
    } else {
      // 如果没有有效的幻灯片内容，添加一个错误幻灯片
      const errorSlide = pres.addSlide();
      errorSlide.addText("内容生成失败", { 
        x: 1, 
        y: 2, 
        fontSize: 24,
        color: "FF0000" 
      });
      errorSlide.addText("请尝试提供更详细的内容描述", { 
        x: 1, 
        y: 3, 
        fontSize: 16,
        color: "666666" 
      });
    }

    console.log('Writing PPT file...');
    // 生成PPT文件
    try {
      // 使用文件系统写入临时文件，然后读取发送
      const fs = require('fs');
      const path = require('path');
      const tempFile = path.join(__dirname, 'temp.pptx');
      
      // 写入到文件系统
      await pres.writeFile(tempFile);
      console.log('PPT file written to disk:', tempFile);
      
      // 读取文件并发送
      const fileData = fs.readFileSync(tempFile);
      console.log('Sending PPT file to client...');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', 'attachment; filename=presentation.pptx');
      res.send(fileData);
      
      // 删除临时文件
      fs.unlinkSync(tempFile);
      console.log('PPT file sent successfully and temp file removed');
    } catch (writeError) {
      console.error('Error writing PPT:', writeError);
      res.status(500).send(`生成PPT文件时发生错误: ${writeError.message}`);
    }
  } catch (error) {
    console.error('Server Error:', error);
    res.status(500).send(`生成PPT时发生错误: ${error.message}`);
  }
});

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});