from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError

def validate_upload(f):
    # Never serve arbitrary uploaded HTML/SVG or executable files.
    ext=f.name.rsplit('.',1)[-1].lower()
    if ext not in ['jpg','jpeg','png','webp','mp4','webm']: raise ValidationError('仅支持 JPG、PNG、WebP、MP4、WebM')
    if f.size>250*1024*1024: raise ValidationError('文件不得超过 250MB')
    head=f.read(32); f.seek(0)
    valid=(ext in ['jpg','jpeg'] and head.startswith(b'\xff\xd8\xff') or ext=='png' and head.startswith(b'\x89PNG\r\n\x1a\n') or ext=='webp' and head.startswith(b'RIFF') and head[8:12]==b'WEBP' or ext=='mp4' and head[4:8]==b'ftyp' or ext=='webm' and head.startswith(b'\x1aE\xdf\xa3'))
    if not valid: raise ValidationError('文件格式与扩展名不匹配')
class Category(models.Model):
    name=models.CharField('名称',max_length=60,unique=True)
    def __str__(self): return self.name
class Tag(Category):
    class Meta: verbose_name='标签'
class Post(models.Model):
    title=models.CharField('标题',max_length=200)
    body=models.TextField('正文')
    kind=models.CharField('类型',max_length=10,choices=[('diary','日记'),('essay','随笔'),('video','视频'),('article','文章')],default='essay')
    visibility=models.CharField('权限',max_length=10,choices=[('public','公开'),('members','注册用户'),('private','仅自己')],default='public')
    category=models.ForeignKey(Category,null=True,blank=True,on_delete=models.SET_NULL)
    tags=models.ManyToManyField(Tag,blank=True,related_name='posts')
    created=models.DateTimeField('发布时间',auto_now_add=True)
    class Meta: ordering=['-created']
    def __str__(self): return self.title
class Attachment(models.Model):
    post=models.ForeignKey(Post,on_delete=models.CASCADE,related_name='attachments')
    file=models.FileField(upload_to='%Y/%m/',validators=[validate_upload])
    downloadable=models.BooleanField('允许登录用户下载',default=False)
    @property
    def video(self): return self.file.name.lower().endswith(('.mp4','.webm'))
class Comment(models.Model):
    post=models.ForeignKey(Post,on_delete=models.CASCADE,related_name='comments')
    user=models.ForeignKey(settings.AUTH_USER_MODEL,on_delete=models.CASCADE)
    body=models.TextField(max_length=2000)
    approved=models.BooleanField('审核通过',default=False)
    created=models.DateTimeField(auto_now_add=True)
class SiteSettings(models.Model):
    name=models.CharField(max_length=80,default='凌晨的海')
    description=models.CharField(max_length=300,default='在天亮之前，收集生活的微光。')
    icp=models.CharField('备案信息',max_length=100,blank=True)
    style=models.CharField(max_length=10,choices=[('sea','深海'),('light','晨光')],default='sea')
