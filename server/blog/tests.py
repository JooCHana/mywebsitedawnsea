from django.test import TestCase
from django.contrib.auth.models import User
from .models import Post,Attachment,Comment
class AccessTests(TestCase):
    def setUp(self):
        self.member=User.objects.create_user('reader',password='Test-password-932')
        self.owner=User.objects.create_superuser('owner',password='Test-password-932')
        self.posts={v:Post.objects.create(title=v,body='正文',visibility=v) for v in ['public','members','private']}
    def test_visibility(self):
        for user,allowed in [(None,['public']),(self.member,['public','members']),(self.owner,['public','members','private'])]:
            self.client.logout()
            if user: self.client.force_login(user)
            for visibility,post in self.posts.items():
                self.assertEqual(self.client.get(f'/post/{post.pk}/').status_code,200 if visibility in allowed else 404)
    def test_private_attachment(self):
        attachment=Attachment.objects.create(post=self.posts['private'],file='hidden.png')
        self.assertEqual(self.client.get(f'/media/{attachment.pk}/').status_code,404)
        self.client.force_login(self.member)
        self.assertEqual(self.client.get(f'/media/{attachment.pk}/').status_code,404)
    def test_comment_moderation_and_rate(self):
        self.client.force_login(self.member)
        url=f"/post/{self.posts['public'].pk}/"
        for i in range(2):
            self.client.get(url)
            self.client.post(url,{'body':'一条测试留言','captcha':self.client.session['captcha']})
        self.assertEqual(Comment.objects.count(),1)
        self.assertFalse(Comment.objects.get().approved)
    def test_pages(self):
        for url in ['/','/login/','/register/','/?date=invalid']:
            self.assertEqual(self.client.get(url).status_code,200)

class MemberFlowTests(TestCase):
    def test_registration_login_and_sections(self):
        for url in ['/observations/','/diary/','/essays/','/login/','/register/']:
            self.assertEqual(self.client.get(url).status_code,200)
        self.client.get('/register/')
        response=self.client.post('/register/',{'username':'newreader','password1':'Ocean-Test-48273!','password2':'Ocean-Test-48273!','captcha':self.client.session['captcha']})
        self.assertRedirects(response,'/login/')
        self.assertTrue(self.client.login(username='newreader',password='Ocean-Test-48273!'))
        self.assertEqual(self.client.get('/account/').status_code,200)
        self.client.post('/logout/')
        self.assertEqual(self.client.get('/account/').status_code,302)
    def test_section_filter_and_privacy(self):
        Post.objects.create(title='Public diary',body='Hello',kind='diary')
        Post.objects.create(title='Secret diary',body='Hidden',kind='diary',visibility='private')
        Post.objects.create(title='Essay entry',body='Thought',kind='essay')
        response=self.client.get('/diary/')
        self.assertContains(response,'Public diary')
        self.assertNotContains(response,'Secret diary')
        self.assertNotContains(response,'Essay entry')
