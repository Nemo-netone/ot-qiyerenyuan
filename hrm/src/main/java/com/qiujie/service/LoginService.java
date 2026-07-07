package com.qiujie.service;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.qiujie.dto.Response;
import com.qiujie.dto.ResponseDTO;
import com.qiujie.entity.Staff;
import com.qiujie.enums.BusinessStatusEnum;
import com.qiujie.mapper.StaffMapper;
import com.qiujie.util.JWTUtil;
import com.qiujie.util.MD5Util;
import com.qiujie.vo.StaffDeptVO;
import org.springframework.stereotype.Service;

import javax.annotation.Resource;

/**
 * @Author : qiujie
 * @Date : 2022/1/30
 */

@Service
public class LoginService extends ServiceImpl<StaffMapper, Staff> {

    @Resource
    private StaffMapper staffMapper;

    public ResponseDTO login(Staff staff) {
        String password = MD5Util.MD55(staff.getPassword());
        StaffDeptVO staffDeptVO = this.staffMapper.findStaffInfo(staff.getCode(), password);
        if (staffDeptVO != null) {
            if (staffDeptVO.getStatus() == 1) {
                String token = JWTUtil.generateToken(staffDeptVO.getId(), password);
                return Response.success(staffDeptVO, token);
            }
            return Response.error(BusinessStatusEnum.STAFF_STATUS_ERROR);
        }
        return Response.error("用户名或密码错误!");
    }
}
