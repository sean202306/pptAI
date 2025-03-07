import React, { useState } from 'react';
import { Layout, Input, Button, message } from 'antd';
import axios from 'axios';
import './App.css';

const { Header, Content } = Layout;
const { TextArea } = Input;

function App() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim()) {
      message.error('请输入内容');
      return;
    }

    setLoading(true);
    try {
      message.info('正在生成PPT，请稍候...');
      const response = await axios.post('http://localhost:3002/api/generate-ppt', {
        content: content
      }, {
        responseType: 'blob'
      });

      if (!response.data) {
        throw new Error('未收到服务器响应');
      }

      // 创建下载链接
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'presentation.pptx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('PPT生成成功！');
    } catch (error) {
      console.error('Error details:', error);
      message.error(`生成PPT失败：${error.message || '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <Header style={{ color: 'white', textAlign: 'center', fontSize: '24px' }}>
        AI PPT生成器
      </Header>
      <Content style={{ padding: '50px' }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
          <TextArea
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="请输入您想要生成PPT的内容..."
            style={{ marginBottom: '20px' }}
          />
          <Button 
            type="primary" 
            onClick={handleSubmit} 
            loading={loading}
            block
          >
            生成PPT
          </Button>
        </div>
      </Content>
    </Layout>
  );
}

export default App;
