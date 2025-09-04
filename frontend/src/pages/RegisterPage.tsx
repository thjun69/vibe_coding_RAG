import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { registerUser } from '../services/api';
import { UserCreate } from '../types';

const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<UserCreate>({
    email: '',
    username: '',
    password: '',
    full_name: '',
  });

  const registerMutation = useMutation({
    mutationFn: registerUser,
    onSuccess: () => {
      // 회원가입 성공 시 로그인 페이지로 이동
      navigate('/login', { 
        state: { 
          message: '회원가입이 완료되었습니다. 로그인해주세요.' 
        }
      });
    },
    onError: (error: any) => {
      console.error('Registration failed:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // 클라이언트 측 검증
    const usernamePattern = /^[a-zA-Z0-9가-힣_\-\s]+$/;
    if (!usernamePattern.test(formData.username)) {
      alert('사용자명은 한글, 영문, 숫자, 하이픈(-), 언더스코어(_), 공백만 사용 가능합니다.');
      return;
    }
    
    if (formData.username.length < 2 || formData.username.length > 50) {
      alert('사용자명은 2-50자 길이여야 합니다.');
      return;
    }
    
    if (formData.password.length < 8) {
      alert('비밀번호는 최소 8자 이상이어야 합니다.');
      return;
    }
    
    const submitData = {
      ...formData,
      full_name: formData.full_name || undefined // 빈 문자열인 경우 undefined로 변환
    };
    registerMutation.mutate(submitData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const isFormValid = formData.email && formData.username && formData.password.length >= 8;

  // 비밀번호 강도 체크
  const passwordStrength = {
    length: formData.password.length >= 8,
    uppercase: /[A-Z]/.test(formData.password),
    lowercase: /[a-z]/.test(formData.password),
    number: /\d/.test(formData.password),
    special: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password),
  };

  const passwordScore = Object.values(passwordStrength).filter(Boolean).length;

  const getPasswordStrengthColor = () => {
    if (passwordScore < 2) return 'bg-red-500';
    if (passwordScore < 4) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  const getPasswordStrengthText = () => {
    if (passwordScore < 2) return '약함';
    if (passwordScore < 4) return '보통';
    return '강함';
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900">회원가입</h2>
          <p className="mt-2 text-sm text-gray-600">
            이미 계정이 있으신가요?{' '}
            <Link
              to="/login"
              className="font-medium text-blue-600 hover:text-blue-500"
            >
              로그인하기
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* 에러 메시지 */}
            {registerMutation.isError && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <AlertCircle className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      회원가입 실패
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      {(registerMutation.error as any)?.response?.data?.details ? (
                        <div>
                          <div className="font-medium">입력 검증 오류:</div>
                          <ul className="mt-1 list-disc list-inside">
                            {(registerMutation.error as any).response.data.details.map((error: any, index: number) => (
                              <li key={index}>
                                {error.loc?.[1] === 'email' && '이메일 형식이 올바르지 않습니다.'}
                                {error.loc?.[1] === 'username' && '사용자명 형식이 올바르지 않습니다. (2-50자, 한글/영문/숫자/하이픈/언더스코어/공백만 허용)'}
                                {error.loc?.[1] === 'password' && '비밀번호는 8-100자 길이여야 합니다.'}
                                {!['email', 'username', 'password'].includes(error.loc?.[1]) && error.msg}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : (
                        (registerMutation.error as any)?.response?.data?.detail || 
                        '회원가입 중 오류가 발생했습니다.'
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 이메일 */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                이메일 *
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formData.email}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="example@email.com"
                />
              </div>
            </div>

            {/* 사용자명 */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700">
                사용자명 *
              </label>
              <div className="mt-1">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="사용자명 (2-50자, 한글/영문/숫자/특수문자 사용 가능)"
                />
              </div>
              <p className="mt-1 text-xs text-gray-500">
                2-50자, 한글/영문/숫자/하이픈/언더스코어/공백 사용 가능
              </p>
            </div>

            {/* 실명 (선택사항) */}
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                실명 (선택사항)
              </label>
              <div className="mt-1">
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="홍길동"
                />
              </div>
            </div>

            {/* 비밀번호 */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                비밀번호 *
              </label>
              <div className="mt-1 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="appearance-none block w-full px-3 py-2 pr-10 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                  placeholder="8자 이상의 비밀번호"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              
              {/* 비밀번호 강도 표시 */}
              {formData.password && (
                <div className="mt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-500">비밀번호 강도:</span>
                    <span className={`font-medium ${
                      passwordScore < 2 ? 'text-red-600' : 
                      passwordScore < 4 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {getPasswordStrengthText()}
                    </span>
                  </div>
                  <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${getPasswordStrengthColor()}`}
                      style={{ width: `${(passwordScore / 5) * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className={`flex items-center ${passwordStrength.length ? 'text-green-600' : 'text-gray-400'}`}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      8자 이상
                    </div>
                    <div className={`flex items-center ${passwordStrength.uppercase ? 'text-green-600' : 'text-gray-400'}`}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      대문자 포함
                    </div>
                    <div className={`flex items-center ${passwordStrength.lowercase ? 'text-green-600' : 'text-gray-400'}`}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      소문자 포함
                    </div>
                    <div className={`flex items-center ${passwordStrength.number ? 'text-green-600' : 'text-gray-400'}`}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      숫자 포함
                    </div>
                    <div className={`flex items-center ${passwordStrength.special ? 'text-green-600' : 'text-gray-400'}`}>
                      <CheckCircle className="w-3 h-3 mr-1" />
                      특수문자 포함
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 회원가입 버튼 */}
            <div>
              <button
                type="submit"
                disabled={!isFormValid || registerMutation.isPending}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {registerMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    회원가입 중...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4 mr-2" />
                    회원가입
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
